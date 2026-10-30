# HU-13 backend: bajarse de un partido pendiente

## Fases realizadas

1. Actualicé `Desarrollo` con `git pull --ff-only origin Desarrollo` y creé `feature/hu13-bajarse-back` desde la referencia actualizada.
2. Documenté el contrato como borrador TDD-0017 para revisión humana en la PR.
3. Agregué pruebas unitarias para el límite inclusivo de dos horas y pruebas HTTP/PostgreSQL para autenticación, entradas inválidas, baja idempotente, reapertura, avisos y rollback.
4. Implementé una baja transaccional que conserva la reserva, reabre partidos completos y devuelve el partido actualizado.
5. Ensanché el tipo de aviso con una migración aditiva y documenté el endpoint.

## Archivos principales

- `backend/internal/matches/model.go`, `service.go` y `postgres.go`: contrato, validación, ruta y persistencia transaccional.
- `backend/cmd/api/routes.go`: montaje de la ruta protegida y reloj inyectable.
- `backend/migrations/009_match_leave_notices.sql`: tipo de aviso `player_left` y repetición segura de avisos `match_completed`.
- `backend/internal/matches/leave_window_test.go`, `backend/cmd/api/match_leave_http_test.go` y `backend/migrations/009_match_leave_notices_test.go`: pruebas unitarias y de integración.
- `docs/backend/TDDs/TDD-0017-hu-13-bajarse-de-partido-pendiente.md`: TDD pendiente de aprobación de revisión.

## Validaciones

- RED: `go test -count=1 ./internal/matches` falló inicialmente con referencias no definidas a `validateLeaveWindow` y `ErrTooLate`, como se esperaba.
- GREEN: `go test -count=1 ./...` pasó con `TEST_DATABASE_URL` contra PostgreSQL temporal descartable; incluyó tests HTTP, concurrencia y migración 009.
- `go vet ./...`: pasó.
- `docker build --target build -f Dockerfile`: pasó.
- `git diff --check`: pasó.
- El contenedor PostgreSQL temporal `hu13-postgres-test` se usó solo para las pruebas y se detuvo al finalizar.

## Límites y dependencias

- Esta PR implementa solo la etapa backend. La etapa frontend requiere que HU-13 backend y HU-17 estén integradas en `Desarrollo`.
- El organizador no puede darse de baja; debe cancelar según HU-14.
- Perder un jugador reabre el partido, pero no libera ni cancela el turno.
- No se implementa vencimiento automático, email, WhatsApp ni el nombre de quien se bajó en el aviso.
