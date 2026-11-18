# HU-19 — Registrar ausencia

## Preparación y diagnóstico previo

- Base actualizada: `origin/Desarrollo`, `003e9ab` (2026-11-14).
- Rama: `feature/registrar-ausencia`; worktree: `.worktrees/hu19-registrar-ausencia`.
- Checkout principal y worktrees HU-16, integración y validación HU-13 preservados, incluidos sus cambios sin commit.
- Autorización explícita del pedido para frontend, backend, migración, pruebas y documentación. Sin commit, push, PR ni acciones en Trello.
- Go/pgx, PostgreSQL, módulos modelo/servicio/repositorio, rutas `RequireUser`; Angular 21 y Vitest. Se leyeron AGENTS.md, AGENTS_BACK.md, reglas de negocio y plantilla TDD.
- `pending_matches` y `pending_match_players` permanecen después del turno; no hay tarea que los elimine por finalizar. `reservations` conserva inicio y fin reales. HU-17 consulta los pasados por `ends_at <= now`.
- HU-13 borra inscripciones al bajarse y elimina el partido si queda vacío. Es imposible reconstruir esas identidades con la información actual. No se modifica esa historia ni se fabrica historial.
- `full_matches`/`full_match_invitations` de HU-16 conservan otra población; no se convierten en `pending_matches` ni aparecen en `GET /api/v1/me/reservations`. Integrarlos requiere ampliar esa consulta y definir un modelo común; decisión consultada al usuario.
- Reservas web/manuales y acompañantes sin cuenta no tienen un plantel completo identificable. RN-04 y la decisión pendiente de RN para HU-19 impiden atribuirles una ausencia individual.

## Propuesta mínima y límites

Reportes persistentes sobre integrantes identificados y conservados de `pending_matches`. FK compuestas, clave única y prohibición de autorreporte en PostgreSQL. Estado confirmado derivado de al menos dos reportantes. Bloqueo transaccional y reloj después de adquirir bloqueos. No hace falta crear un historial artificial para los partidos conservados.

Para futuros cambios que eliminen históricos, sería necesario acordar una instantánea inmutable de participantes al inicio/finalización y una política de conservación. No permite recuperar registros ya borrados. Los reportes existentes quedarán protegidos con `ON DELETE RESTRICT`.

Pendiente: aprobación de cancelados, bajas previas, acompañantes sin identidad, históricos eliminados e integración HU-16. No se implementa reputación ni notificaciones.

## Contratos

- [TDD-0018: alta](../backend/TDDs/TDD-0018-hu-19-registrar-ausencia.md).
- [TDD-0019: consulta](../backend/TDDs/TDD-0019-hu-19-consultar-ausencias.md).

## Validaciones backend (2026-11-17)

- Docker Engine 29.7.2 y contenedor `padelmatch-hu19-test-db` disponibles en `127.0.0.1:55439`; pruebas con `padelmatch_test` descartable.
- Fase RED: `go test ./cmd/api -run '^TestHU19' -count=1 -timeout=90s` dio 404 en las rutas ausentes, con conexión PostgreSQL y fixture válidas.
- Fase GREEN: mismo comando pasó; tras agregar prueba directa de constraints, volvió a pasar. Los casos HTTP cubren antes del fin, fin exacto, plazo, límite exacto y vencimiento; auth 401, permisos 403, target ajeno, autorreporte, duplicado, confirmación con dos identidades, concurrencia, persistencia e aislamiento.
- `TestHU19PostgresConstraints` pasó contra PostgreSQL real: CHECK de autorreporte, ambas FK compuestas, clave única (SQLSTATE 23505), `ON DELETE RESTRICT` para membresía/partido y lectura posterior persistida.
- `go vet ./...` pasó. `git diff --check` pasó. `gofmt -d` debe ejecutarse desde `backend/` para los archivos Go (la comprobación desde raíz no resolvió rutas).
- Suite completa `go test -count=1 ./... -timeout=180s`: falló en 6 pruebas de tres paquetes: `cmd/api` (4: `TestManualReservationMigrationPreservesWebData`, `TestHTTPLeaveFullMatchReopensAndNotifiesRemainingPlayers`, `TestHTTPLeaveRacesWithJoinWithoutLosingParticipants`, `TestHTTPPostgresHU04Flow`), `internal/database` (`TestMigrateAppliesHU02Schema`) y `migrations` (`TestMigration011PreservesNoticesAndAllowsRepeatKinds`). `go vet` y HU-19 focalizada sí pasan.
- El rerun aislado de las cuatro pruebas fallidas de `cmd/api` reprodujo las cuatro. El error `2BP01` en el test manual de migración aparece al quitar objetos de esquema mientras existen dependencias nuevas FK hacia `pending_match_players`; requiere adaptar el teardown de esa prueba o crear las constraints como deferrable? No se cambió código ajeno a HU-19. Las demás fallas reportan 404 al reabrir/baja concurrente, datos de complejo inválidos en HU-04, complejo inválido en database y relación `complexes` ausente en migration test. Son de otros alcances y no se alteraron.
- Privacidad: GET limita respuesta a IDs, nombres, estado propio y conteos; no devuelve identidades de reportantes, contactos o correos. Partidos cancelados devuelven 404 y no permiten reportar. Reportes pendientes/confirmados persisten; no hay efectos HU-20.

Backend HU-19 queda listo para integración con Angular, con la suite general del repositorio aún roja en pruebas de otras historias y teardown de migración. PostgreSQL descartable: `padelmatch-hu19-test-db`, puerto local `55439`; no usar base compartida.

## Adaptación sobre Desarrollo (2026-11-17)

- Rama `feature/hu19-integracion`, worktree `.worktrees/hu19-integracion`, creada desde `origin/Desarrollo` `847ba8a89066e7484495dd9163fcb7ecac1310ea`. El worktree original se mantuvo intacto.
- Migración renumerada a `020_match_absence_reports.sql`, después de `019_incomplete_match_release.sql` y de las migraciones 015–018 de Desarrollo. Los tests de fixtures limpian ambas claves históricas (015 y 019) de HU-12 y la clave 020 de HU-19.
- La integración Angular conserva los datos `registeredPlayers`/`guestPlayers`, navegación y controles de Google Calendar de Desarrollo. El panel sigue limitado a partidos `kind=match` elegibles en Jugados.
- HU-12 bloquea la reserva antes del partido durante cancelación. HU-19 fue adaptada para adquirir bloqueos en el mismo orden y rechazar el reporte si reserva o partido están cancelados. `TestHU19CancellationLockOrder` reproduce el orden concurrente del worker y verifica que no se inserte un reporte tras la cancelación.
- Verificación PostgreSQL real: pruebas HU-19 y `TestManualReservationMigrationPreservesWebData` PASS; migraciones completas corrieron en schemas aislados creados por los fixtures. La prueba de concurrencia de HU-19 y la de reportes simultáneos PASS.
- `go vet ./...` PASS y `git diff --check` PASS. `gofmt -d` presenta diferencias LF/CRLF al inspeccionar fuentes existentes con finales CRLF; no se reescribieron masivamente.
- Angular HU-19 componente y servicio: 13/13 PASS. En el spec de Mis partidos, la nueva prueba condicional de HU-19 PASS; una expectativa temporal HU-17 preexistente falla de forma aislada en ese archivo.
- `npm run build` PASS, con advertencias de RouterLink y presupuestos de bundle/estilos.
- Suite Angular completa: 331/355 PASS, 24 FAIL en specs ajenos (bloqueos de TestBed/requests pendientes y expectativas de contrato previas), además de la expectativa temporal HU-17. Suite backend completa: fallas en 8 tests de `cmd/api`, 1 de `internal/database` y 1 de `migrations`; los focalizados HU-19 sí pasan. No se modificaron esos comportamientos fuera de alcance.
- Las suites completas permanecen rojas por fallas ya presentes en la base; se documentan abajo tras comparación directa. No se hizo commit, push ni PR.

## Ajuste tras el merge de HU-18 (2026-11-17)

- `origin/Desarrollo` avanzó a `36cfa7dcffa5d1580426b8f1f9c7b2abfa2df873`. Los archivos funcionales de HU-18 no se superponen con HU-19. Desarrollo ocupa la migración 019 con HU-12; HU-19 usa ahora `020_match_absence_reports.sql`.
- HU-12 renombró `015_incomplete_match_release.sql` a `019_incomplete_match_release.sql` sin cambiar el contenido SQL. La migración reemplaza explícitamente sus dos constraints con `DROP CONSTRAINT` + `ADD CONSTRAINT`, por lo que volver a ejecutarla sobre una base con la versión antigua es seguro. `TestHU19RenamedMigrationIsSafeForExistingDatabase` verifica el caso con PostgreSQL real y el registro de la clave renombrada.
- Ajustado el fixture manual para borrar ambos nombres de HU-12 y el nuevo nombre de HU-19 al reconstruir el esquema.

## Comparación de regresiones contra Desarrollo limpio (2026-11-17)

- Base temporal exportada de `847ba8a89066e7484495dd9163fcb7ecac1310ea`, con `npm ci` desde el lockfile y pruebas Go contra el mismo contenedor PostgreSQL que HU-19.
- Backend: las 8 fallas funcionales de `cmd/api`, `TestMigrateAppliesHU02Schema` y `TestMigration011PreservesNoticesAndAllowsRepeatKinds` se reproducen en la base. El fixture `TestManualReservationMigrationPreservesWebData` también falla en la base por la tabla de participantes invitados; pasa en la rama HU-19 tras adaptar el teardown. No se detectaron regresiones backend atribuibles a HU-19.
- Angular: las mismas 24 pruebas fallan en los mismos 8 archivos en base y rama HU-19. Los síntomas son solicitudes HTTP sin resolver/estado TestBed compartido, contratos de jugadores invitados, fixtures de partidos y una expectativa temporal HU-17. Las pruebas nuevas de HU-19 pasan; no se identificaron regresiones frontend atribuibles a HU-19.
- La migración HU-12 renombrada conserva el mismo SQL. El test PostgreSQL reejecuta esa migración sobre el esquema ya migrado, registrando la clave 019; los `DROP CONSTRAINT` + `ADD CONSTRAINT` hacen seguro el reintento por cambio de nombre.
- La migración HU-19 es `020_match_absence_reports.sql`; Desarrollo 36cfa7d no tiene una migración 020.
- Las fallas globales quedan documentadas como estado de la base; no requieren cambios en HU-19. HU-19 puede avanzar a revisión de PR, sujeto a actualizar la rama con Desarrollo 36cfa7d en el proceso de integración acordado.
