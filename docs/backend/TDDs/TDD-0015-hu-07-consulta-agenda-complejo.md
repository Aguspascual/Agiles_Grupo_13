---
id: "0015"
estado: "Borrador v2 para aprobación humana; la aprobación ocurre en la revisión de la PR"
version: 2
autor: "Equipo backend"
fecha: "2026-10-30"
titulo: "Consulta de la agenda del complejo"
hu: HU-07
capa: backend
---

# TDD-0015: Consulta de la agenda del complejo

## Contexto de Negocio (PRD)

### Objetivo
Dar al encargado la grilla del día de su complejo con quién reservó cada turno (nombre y
teléfono), para atender y cancelar reservas. La grilla pública (HU-05, TDD-0009) no cambia y
sigue sin exponer datos personales.

### User Persona
*   **Nombre**: Encargado del complejo / administrador general.
*   **Necesidad**: ver de un vistazo turnos libres, reservados (con contacto) y bloqueados.

### Criterios de Aceptación
*   **CA-01 — Permisos**: solo administrador general o encargado asignado al complejo,
    validado dentro de la transacción (`AuthorizeManager`). Actor ajeno: `403` antes de
    revelar si el complejo existe. Complejo inexistente (tras autorizar): `404`.
*   **CA-02 — Ventana**: `date` obligatorio, único query param, entre hoy y hoy+13 (igual que
    `/slots`); en otro caso `400`.
*   **CA-03 — Contacto**: cada reserva `reserved` que se superpone con el día incluye origen
    (`web|manual`), nombre y teléfono, también las que ya no alinean con la grilla.
*   **CA-04 — Slots**: misma proyección que HU-05 (`AVAILABLE|RESERVED|BLOCKED`, `isPast`); los
    `RESERVED` traen `reservationId`.
*   **CA-05 — Cancelable**: `cancellable = status='reserved' AND ends_at > now`, calculado por
    el servidor.
*   **CA-06 — Sin regresión**: el JSON de `GET /complexes/{id}/slots` no cambia.
*   **CA-07 — Canchas**: las canchas dadas de baja no aparecen.
*   **CA-08 — Partidos pendientes (v2)**: cada reserva `origin='open_match'` trae `pendingMatch`
    con estado, nivel buscado, cuántos jugadores faltan y los anotados (nombre, nivel y
    posición). Las reservas `web` y `manual` no emiten la clave.
*   **CA-09 — Privacidad (v2)**: los anotados se publican sin id de usuario, correo ni teléfono
    (misma información que `GET /matches`). `GET /complexes/{id}/slots` no cambia.
*   **CA-10 — Consistencia (v2)**: un `open_match` sin fila en `pending_matches` se devuelve sin
    `pendingMatch` y sin error. Una baja de anotado se refleja como un faltante más.

## Diseño Técnico (RFC)

### Modelo de Datos
Sin migraciones (v2 solo lee `pending_matches`, `pending_match_players` y `player_profiles`). Paquete `backend/internal/agenda`; reutiliza `slots.ReadCourtData` y
`slots.ProjectCourt` (exportados sin cambiar `slots.Slot`).

### Contrato de API (C1)
*   **Endpoint**: `GET /api/v1/complexes/{complexId}/agenda?date=AAAA-MM-DD`
*   **Autenticación**: Bearer. **Headers**: `Cache-Control: no-store`.
*   **Response 200**:
```json
{ "complex": {"id":"…","name":"…","address":"…","zone":"…"}, "date": "2026-11-02",
  "courts": [{ "id":"…", "name":"Cancha 1", "covered": true,
    "slots": [{"id":"…","startsAt":"18:00","endsAt":"19:30","status":"RESERVED","isPast":false,"reservationId":"…"}],
    "reservations": [{"id":"…","origin":"web","startsAt":"18:00","endsAt":"19:30",
       "originalStartsAt":"2026-11-02T18:00:00-03:00","originalEndsAt":"2026-11-02T19:30:00-03:00",
       "contact":{"name":"…","phone":"…"},"cancellable":true}] }] }
```
Solo las reservas con `origin == "open_match"` agregan `pendingMatch` (las `web` y `manual` no
emiten la clave):
```json
"pendingMatch": {
  "id": "<uuid del partido>",
  "status": "open|full",
  "targetLevel": "5ta",
  "missingPlayers": 2,
  "players": [
    {"name": "Ana Pérez", "level": "5ta", "position": "Drive", "organizer": true},
    {"name": "Luis Gómez", "level": "6ta", "organizer": false}
  ]
}
```
*   `players` va ordenado: organizador primero y luego por `joined_at`. `position` solo se emite si
    existe. `missingPlayers = 4 − len(players)`. `status` es `pending_matches.status`.
*   Los `slots[]` no cambian (siguen `RESERVED` con `reservationId`).

### Componentes del Monolito Modular
*   **Modelo**: tipos de respuesta y asociación slot ↔ reserva.
*   **Servicio HTTP**: valida fecha y ventana, resuelve el actor y mapea errores.
*   **Repositorio**: transacción con complejo `FOR SHARE`, autorización, lectura de canchas,
    horario del día y reservas con contacto. v2: segunda consulta parametrizada, en la misma
    transacción, de los partidos de esas reservas (sin bloqueos nuevos).

## Casos de Borde y Errores
| Escenario | Resultado Esperado | Código HTTP |
| --- | --- | --- |
| Sin token | `no autorizado` | 401 Unauthorized |
| Jugador o encargado de otro complejo | No revela existencia | 403 Forbidden |
| Complejo inexistente, actor administrador | `complejo no encontrado` | 404 Not Found |
| Fecha ausente, inválida, fuera de ventana, query extra | `solicitud inválida` | 400 Bad Request |
| Reserva que terminó | Se lista con `cancellable:false` | 200 OK |
| Reserva desalineada de la grilla | Solo en `reservations[]` | 200 OK |
| `open_match` sin fila de partido (dato inconsistente) | Sin `pendingMatch`, sin error | 200 OK |
| Partido de una reserva cancelada | No aparece | 200 OK |

## Plan de Implementación
1. Aprobar criterios y contrato en la revisión de la PR.
2. Red: pruebas HTTP y PostgreSQL, incluida la que fija el JSON público de `/slots`.
3. Green: repositorio, modelo y handler.
4. Refactor y documentación en `docs/backend/HU-07-implementacion.md`.
