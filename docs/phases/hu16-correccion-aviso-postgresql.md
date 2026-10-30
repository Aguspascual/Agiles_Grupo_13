# HU-16 · Corrección del aviso de confirmación

## Fase realizada

Se corrigió la inferencia de tipos de PostgreSQL en el `jsonb_build_object` del aviso `reservation_confirmed`. Los valores textuales ahora tienen casts explícitos a `text`. Se incorporó un recorrido HTTP con persistencia real para cubrir creación, invitaciones ligadas a cuentas, rechazo de un invitado incorrecto, aceptación, confirmación, vencimiento y liberación del turno.

## Archivos principales

- `backend/internal/reservations/full_matches.go`: casts SQL explícitos para los campos textuales del aviso.
- `backend/cmd/api/full_matches_http_test.go`: recorrido HTTP/PostgreSQL de HU-16.

## Validaciones

- PostgreSQL 17 descartable: `go test -count=1 ./cmd/api -run '^TestHTTPFullMatchInvitationsFlow$' -v` — pasó.
- PostgreSQL 17 descartable: `go test -count=1 ./...` — pasó.
- `go vet ./...` — pasó.
- `git diff --check` — pasó.

## Límites

El cambio cubre el error SQL del aviso de creación de partido completo. No modifica contratos ni reglas de negocio, migraciones, frontend, ni el comportamiento de HU-13.
