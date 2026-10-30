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
- `pendingMatch` no se emite (depende de HU-09/10/11, sin backend).

## Validación

- `cmd/api/agenda_http_test.go`: 401/403/404/400, ventana de fechas, query estricta, contacto web y manual, reserva
  desalineada y fuera de grilla, `cancellable` falso al terminar, cancha dada de baja, liberación tras cancelar, y la prueba
  que fija las claves del JSON público de `/slots`.
- `go test -count=1 ./...` y `go vet ./...` con `TEST_DATABASE_URL` hacia `padelmatch_test`.

## Límites

Sin partidos pendientes ni anotados, sin edición de reservas, ventana hoy..hoy+13.