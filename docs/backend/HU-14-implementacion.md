# HU-14 y HU-07 (backend): cancelación de reservas

Estado: implementado, a la espera de revisión. Diseño: [TDD-0010 v3](TDDs/TDD-0010-hu-14-cancelacion-reserva.md)
(jugador) y [TDD-0016](TDDs/TDD-0016-hu-07-cancelacion-por-encargado.md) (encargado), ambos
"Borrador para aprobación humana": la aprobación ocurre en la revisión de la PR.

## Qué se entrega

| Contrato | Ruta | Actor | Regla de tiempo |
| --- | --- | --- | --- |
| C3 | `POST /api/v1/reservations/{id}/cancel` | Organizador de reserva web | `now <= starts_at - 4 h` (inclusivo) |
| C2 | `POST /api/v1/complexes/{complexId}/reservations/{id}/cancel` | Administrador o encargado asignado | `ends_at > now` |

- Núcleo común `cancel(...)` en `backend/internal/reservations/cancel.go`; handlers en
  `cancel_http.go`; rutas en `backend/cmd/api/routes.go` bajo `auth.RequireUser`.
- Reloj del servidor inyectable (`NewRepositoryWithClock`), usado desde `newHandlerWithClock`.
- Locks en el orden `complejo FOR SHARE → cancha FOR UPDATE → reserva FOR UPDATE`, sin exigir
  complejo ni cancha activos. El UPDATE exige `status='reserved'`.
- Aviso `reservation_cancelled` en la misma transacción si hay organizador; `ON CONFLICT
  (reservation_id, kind) DO NOTHING` como segunda barrera. Las reservas manuales no avisan.
- Migración `006_reservation_cancellation_notice.sql`: solo ensancha el CHECK de `kind`. El
  runner la registra por nombre y se aplica aunque `007` ya esté aplicada.
- `GET /reservation-notices` no cambia de forma: `type` pasa a poder ser `reservation_cancelled`.

## Respuestas

200 `{reservation:{id,status:"cancelled",complex,court,date,startsAt,endsAt,timeZone}}` sin
contacto. 400 UUID/query/body inválidos, 401 sin token, 403 sin permiso (solo C2, antes de
revelar si el complejo existe), 404 inexistente/ajena (C3: también manuales), 409 fuera de plazo
(C3) o reserva ya finalizada (C2), 500 error interno.

## Validación

- Unitarias: límite de 4 h exacto y un nanosegundo después; fin de reserva (`cancel_test.go`).
- HTTP + PostgreSQL real (`cmd/api/cancel_http_test.go`): permisos, 400/401/403/404/409, respuesta
  sin contacto, idempotencia, aviso único, rollback si falla el aviso, cancelaciones concurrentes,
  cancelación vs alta en ambos órdenes, manual sin aviso, liberación del intervalo, `GET /reservations`
  sin la cancelada, migración 006 sobre base ya migrada.
- Locks (`schedules/cancel_lock_order_test.go`): cancelación vs baja de cancha, baja de día y cambio
  de franjas, en ambos órdenes y para ambas políticas.
- `go test -count=1 ./...` y `go vet ./...` con `TEST_DATABASE_URL` hacia `padelmatch_test`.

## Límites

Sin pantalla de jugador (HU-17), sin avisos externos, sin cancelación de reservas ya terminadas,
sin reprogramación. Los tres acompañantes no tienen identidad, por lo que solo se avisa al organizador.
