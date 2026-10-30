# HU-07 (backend): agenda del complejo

Estado: implementado, a la espera de revisión. Diseño: [TDD-0015](TDDs/TDD-0015-hu-07-consulta-agenda-complejo.md)
(borrador para aprobación humana en la revisión de la PR). La cancelación por el encargado está en
[HU-14-implementacion](HU-14-implementacion.md).

## Qué se entrega

- `GET /api/v1/complexes/{complexId}/agenda?date=AAAA-MM-DD` (contrato C1) con Bearer y `Cache-Control: no-store`.
- Paquete `backend/internal/agenda`: modelo (`model.go`), repositorio transaccional (`postgres.go`) y handler (`service.go`).
- Reutiliza `slots.ReadCourtData` y `slots.ProjectCourt` (extraídos/exportados sin cambiar el JSON de `slots.Slot`) y
  `reservations.AuthorizeManager` (mismo chequeo que HU-15).
- Autorización dentro de la transacción tras bloquear el complejo `FOR SHARE`: actor ajeno 403 antes de revelar si existe;
  complejo inexistente 404 solo tras autorizar. Por ese lock la transacción no es de solo lectura.
- `reservations[]` incluye toda reserva `reserved` que se superpone con el día, aunque no alinee con la grilla;
  `cancellable = ends_at > now`. Canchas dadas de baja no aparecen.

## Partidos pendientes en la agenda (TDD-0015 v2)

- Cada reserva `origin='open_match'` agrega `pendingMatch`: `id`, `status` (`open|full`), `targetLevel`,
  `missingPlayers` (`4 − anotados`) y `players` (`name`, `level`, `position` solo si existe, `organizer`).
  Las reservas `web` y `manual` no emiten la clave.
- `players` va con el organizador primero y luego por `joined_at`. No incluye ids de usuario, correo ni teléfono.
- Archivo `internal/agenda/pending.go`: segunda consulta parametrizada (`reservation_id = ANY($1)`) en la misma
  transacción que autoriza y lee el día; solo lectura, sin bloqueos nuevos ni migración.
- Un `open_match` sin fila en `pending_matches` se devuelve sin `pendingMatch` y sin error. Si un anotado se da de
  baja (HU-13) la agenda muestra un faltante más. No se toca `matches/`, `reservations/` ni `slots/`.
- Pruebas: `cmd/api/agenda_pending_http_test.go` (solo organizador, con anotados, completo, orden, web/manual sin la
  clave, reserva cancelada, baja de un anotado, sin fugas de datos, permisos, dato huérfano) y la prueba de que
  `/slots` no expone jugadores ni campos nuevos con un partido abierto.

## Validación

- `cmd/api/agenda_http_test.go`: 401/403/404/400, ventana de fechas, query estricta, contacto web y manual, reserva
  desalineada y fuera de grilla, `cancellable` falso al terminar, cancha dada de baja, liberación tras cancelar, y la prueba
  que fija las claves del JSON público de `/slots`.
- `go test -count=1 ./...` y `go vet ./...` con `TEST_DATABASE_URL` hacia `padelmatch_test`.

## Límites

Cancelar un partido abierto no avisa a los anotados (HU-14), no se editan ni mueven anotados desde la agenda, sin edición de reservas, ventana hoy..hoy+13.