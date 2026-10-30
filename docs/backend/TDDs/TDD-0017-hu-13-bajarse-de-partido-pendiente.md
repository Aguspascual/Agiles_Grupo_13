---
autor: Equipo PádelMatch
fecha: 2026-10-30
titulo: Baja de un jugador de un partido pendiente
---

# TDD-0017: baja de un jugador de un partido pendiente

## Estado

Borrador v1 para aprobación humana en la revisión de la PR HU-13 backend. El contrato y las decisiones siguen el plan de HU-13 adjunto.

## Contexto de negocio (PRD)

### Objetivo

Permitir que un jugador anotado libere su lugar de un partido pendiente cuando faltan al menos dos horas para el inicio, conservando el turno reservado y avisando al organizador y al grupo restante.

### User persona

- **Nombre**: Jugador anotado.
- **Necesidad**: Liberar su lugar cuando no pueda asistir, sin cancelar la reserva de cancha del grupo.

### Criterios de aceptación

- **CA-01**: Un jugador anotado que no sea organizador puede darse de baja hasta el límite inclusivo de dos horas antes del inicio (RN-03).
- **CA-02**: La baja elimina solo su inscripción y el lugar vuelve a estar disponible.
- **CA-03**: Si el partido estaba completo, vuelve a estado `open` y aparece nuevamente en la búsqueda.
- **CA-04**: El turno continúa `reserved`; la baja no cancela la reserva de cancha.
- **CA-05**: El organizador y cada jugador restante reciben un aviso `player_left`; no se avisa a quien se bajó.
- **CA-06**: La operación y sus avisos son atómicos e idempotentes: repetir una baja no anotada responde 200 sin cambios ni avisos adicionales (RN-08).
- **CA-07**: El servidor calcula el límite con `America/Argentina/Buenos_Aires` y sin redondear instantes (RN-07).

## Diseño técnico (RFC)

### Modelo de datos

No se crean entidades. La inscripción se elimina de `pending_match_players`; el partido completo cambia de `full` a `open`; los avisos se guardan en `pending_match_notices`. La migración `009_match_leave_notices.sql` admite `player_left` y elimina la unicidad que impedía avisos repetidos tras ciclos posteriores de partido completo.

### Contrato de API

- **Endpoint**: `DELETE /api/v1/matches/{matchId}/players/me`
- **Autenticación**: Bearer JWT; sin body ni query; `Cache-Control: no-store`.
- **Response 200**: `{"match": <formato público de partido>}` con `status`, `players` y `missingPlayers` actualizados.
- **Errores**: `400` UUID/query/body inválidos; `401` sin sesión; `404` partido inexistente o reserva cancelada; `409` organizador, partido iniciado o límite de dos horas superado. La baja repetida de alguien que ya no figura responde `200` idempotente.
- **Avisos**: `GET /api/v1/match-notices` agrega `kind`: `match_completed` o `player_left`.

### Componentes del monolito modular

- **Modelo**: `ErrOrganizer`, `ErrTooLate` y constante de ruta en `internal/matches/model.go`.
- **Servicio HTTP**: validación de sesión, ruta, UUID, query/body y mapeo de errores.
- **Repositorio**: transacción con bloqueo de `pending_matches`, baja de inscripción, reapertura y avisos en `internal/matches/postgres.go`.
- **Composición de rutas**: ruta protegida en `cmd/api/routes.go`.

## Casos de borde y errores

| Escenario | Resultado esperado | Código HTTP |
| --- | --- | --- |
| Sin JWT | No autorizado | 401 |
| UUID, query o body inesperados | Solicitud inválida, sin mutación | 400 |
| Partido inexistente o reserva cancelada | Recurso no encontrado | 404 |
| Organizador intenta darse de baja | Indica que debe cancelar el partido | 409 |
| Baja en el instante exacto de 2 h | Baja permitida | 200 |
| Baja un nanosegundo después del límite o partido iniciado | Sin mutación | 409 |
| Usuario no anotado/repite la baja | Respuesta idempotente sin avisos | 200 |
| Partido completo pierde un jugador | Pasa a `open`, turno sigue reservado | 200 |
| Falla al guardar un aviso | Rollback de toda la operación | 500 |

## Plan de implementación

1. Añadir pruebas unitarias del límite inclusivo y los errores de dominio.
2. Añadir pruebas HTTP para autenticación, entradas, estados y forma de respuesta.
3. Añadir migración aditiva y pruebas PostgreSQL de persistencia, avisos, rollback y concurrencia.
4. Implementar repositorio transaccional, servicio y ruta protegida.
5. Documentar la API, ejecutar pruebas y registrar resultados en la PR.

## Decisiones y límites

- El organizador no puede darse de baja; debe cancelar el partido mediante HU-14.
- Perder un jugador reabre el partido, incluso si antes estaba completo.
- El turno de cancha permanece reservado.
- La cancelación automática a cuatro horas (RN-05) pertenece al vencimiento de HU-12 y no se implementa acá.
- Los avisos son internos y no incluyen el nombre de quien salió; correo y WhatsApp están fuera de alcance.
