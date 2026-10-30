---
id: "0013"
estado: Borrador para aprobación humana
version: 2
autor: "Equipo backend"
fecha: "2026-10-30"
titulo: "Consulta de reservas y partidos propios, próximos y jugados"
hu: HU-17
capa: backend
trello: "https://trello.com/c/oXCsgyd5"
---

# TDD-0013: Consulta de reservas y partidos propios, próximos y jugados

> Versión 2 (30/10/2026). Reemplaza la v1, que dejó los partidos fuera hasta que existiera persistencia de participación. Ya existe (migración 008: `pending_matches`, `pending_match_players`, reservas con `origin='open_match'`), por lo que esta versión cierra HU-17 completa. Borrador para aprobación humana: la aprobación ocurre en la revisión de la PR.

## Contexto de Negocio (PRD)

### Objetivo
Que el jugador vea en un solo lugar las reservas que hizo y los partidos a los que se sumó, separados en próximos y jugados, con el estado persistido de cada uno. "Jugado" significa que el horario terminó, no que el jugador asistió.

### User Persona
- **Rol:** jugador (organizador de reservas web, organizador o inscripto de partidos abiertos).
- **Necesidad:** consultar sus reservas y partidos sin exponer datos de terceros.

### Criterios de Aceptación
- **CA-01:** JWT obligatorio e identidad exclusivamente del token; devolver solo ítems propios, sin contacto, correos, credenciales ni nombres de otros jugadores.
- **CA-02:** capturar un único instante del servidor por petición (RN-07); próximos si `ends_at > now` (incluye en curso); pasados si `ends_at <= now`.
- **CA-03:** incluir estados persistidos `reserved` y `cancelled`, clasificar por el intervalo original, no inferir asistencia ni inventar un estado "jugado". Conservar ítems de canchas o complejos dados de baja lógica.
- **CA-04:** ordenar próximos por inicio e ID ascendentes y pasados por inicio e ID descendentes; paginación sobre el estado actual, sin garantizar instantánea entre peticiones.
- **CA-05:** validar estrictamente la consulta, responder lista vacía como `items: []` y errores genéricos; no modificar reservas ni avisos.
- **CA-06:** una lista mixta: reservas web propias (`kind=reservation`) y partidos en los que participa el usuario (`kind=match`). Un partido que el usuario organiza aparece solo como `match`, nunca duplicado como reserva. Las reservas manuales nunca aparecen.
- **CA-07:** `cancellable` indica si el jugador puede cancelar hoy: solo reservas web propias `reserved` con `now <= starts_at - 4 h` (misma regla de HU-14, sin duplicar el plazo). Los partidos siempre son `false`.
- **CA-08:** preservar el endpoint por fecha de [TDD-0007](TDD-0007-hu-06-consulta-reservas-propias.md), el alta, la cancelación y los avisos.

## Diseño Técnico (RFC)

### Modelo de Datos
Lectura de `reservations`, `complexes`, `courts`, `pending_matches` y `pending_match_players` por el usuario autenticado y el instante capturado, sin filtrar baja lógica. Los nombres reflejan valores actuales. Sin migraciones ni escrituras; no se crean tablas de historial ni de asistencia.

### Contrato de API
- **Endpoint:** `GET /api/v1/me/reservations?view=upcoming&limit=20&offset=0`.
- **Autenticación:** `Authorization: Bearer <JWT>` obligatorio.
- **Query:** `view` obligatorio (`upcoming` o `past`); `limit` entero opcional entre 1 y 100, predeterminado 20; `offset` entero no negativo opcional, predeterminado 0. Rechazar parámetros desconocidos, repetidos, vacíos o inválidos.
- **Response `200 OK`:**

```json
{
  "items": [{
    "kind": "match",
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "reservationId": "6ba7b812-9dad-41d1-80b4-00c04fd430c8",
    "status": "reserved",
    "complex": { "id": "6ba7b810-9dad-41d1-80b4-00c04fd430c8", "name": "Complejo Norte" },
    "court": { "id": "6ba7b811-9dad-41d1-80b4-00c04fd430c8", "name": "Cancha 1" },
    "startsAt": "2026-11-03T18:00:00-03:00",
    "endsAt": "2026-11-03T19:30:00-03:00",
    "timeZone": "America/Argentina/Buenos_Aires",
    "role": "player",
    "cancellable": false,
    "match": { "status": "open", "targetLevel": "5ta", "missingPlayers": 2 }
  }],
  "page": { "limit": 20, "offset": 0, "hasMore": false }
}
```

- `kind`: `reservation` o `match`. `id` es el de la reserva (`reservation`) o el del partido (`match`); `reservationId` es siempre el de la reserva.
- `status`: estado persistido de la **reserva** (`reserved` o `cancelled`); un partido cuya reserva se canceló es `cancelled`.
- `role`: `organizer` o `player`. Las reservas web siempre son `organizer`.
- `match` solo está presente con `kind=match`: `status` es `pending_matches.status` (`open` o `full`), `targetLevel` el nivel buscado y `missingPlayers = 4 - jugadores`.
- Timestamps ISO 8601 con offset. Sin resultados: `{"items":[],"page":{"limit":20,"offset":0,"hasMore":false}}`. Se consultan como máximo `limit + 1` filas para calcular `hasMore`.
- `Cache-Control: no-store`; errores con el formato existente `{"error":"mensaje"}`. No reemplaza ni modifica `GET /api/v1/reservations?date=AAAA-MM-DD`.

### Componentes del Monolito Modular
- **Modelo:** parser estricto de la query.
- **Servicio HTTP:** reutilizar autenticación; capturar el reloj una vez; responder sin datos sensibles.
- **Repositorio:** una consulta SQL parametrizada (`UNION ALL` de reservas web propias y partidos con participación) en el módulo de reservas existente; `cancellable` con la regla de `cancel.go`.
- **Rutas:** operación independiente protegida con `RequireUser`, también registrada en la rama de error del servicio, como sus hermanas.

## Casos de Borde y Errores
| Escenario | Resultado esperado | HTTP |
| --- | --- | --- |
| JWT ausente o inválido | Error de autenticación | 401 |
| Query desconocida, repetida, vacía o inválida | Error de validación | 400 |
| `ends_at == now` | Pasado | 200 |
| `now == starts_at - 4 h` | `cancellable: true` | 200 |
| Reserva manual del complejo | No aparece | 200 |
| Partido organizado por el usuario | Una sola vez, como `match` | 200 |
| Sin ítems o última página | Lista vacía o restante, `hasMore: false` | 200 |
| Fallo interno | Error genérico sin detalles | 500 |

## Plan de Implementación
1. Parser de query y reglas de clasificación y `cancellable` (unitarias).
2. Repositorio y handler con Red → Green → Refactor por criterio: próximos, en curso, frontera exacta; canceladas e intervalo; aislamiento entre usuarios; manuales excluidas; partido organizado una sola vez; inscripto como `player` con `missingPlayers`; completo; recursos dados de baja; orden, desempate y paginación.
3. Regresión del endpoint por fecha, alta, cancelación y avisos (CA-08).
4. Desde `backend`, `go test -count=1 ./...` y `go vet ./...` con `TEST_DATABASE_URL` exclusivamente descartable (`padelmatch_test`). PostgreSQL omitido queda pendiente, no aprobado.

## Fuera de alcance
Cancelar partidos abiertos y avisar a los anotados (HU-14), anotados y faltantes en la agenda (HU-07), bajarse de un partido (HU-13), asistencia real.
