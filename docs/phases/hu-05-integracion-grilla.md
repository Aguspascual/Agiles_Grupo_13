# HU-05 · Integración de la grilla de turnos con la API

## Fases realizadas

1. Se creó `feature/front-hu05-integrar-grilla` desde `origin/Desarrollo` (HU-01 a HU-04 ya integradas).
2. `SlotGridService` dejó de armar la grilla en el navegador y consulta `GET /api/v1/complexes/{complexId}/slots?date=AAAA-MM-DD` (público, único parámetro `date`).
3. La página de turnos suma un estado de error con botón "Reintentar".
4. El directorio `/clubes` lista los complejos reales con `GET /api/v1/public/complexes` (endpoint nuevo, ver TDD-0014 del backend) en lugar de los clubes de demostración.
5. Se retiraron los remanentes demo de la grilla: canchas y horarios de ejemplo, y los stores locales de complejos y reservas.

## Archivos principales

- `frontend/src/app/slot-grid/slot-grid.service.ts`: mapea `AVAILABLE|RESERVED|BLOCKED` (y, defensivo, `PENDING_MATCH|CLASS`) a los estados de la grilla, completa `courtId` y `date`, usa el `isPast` del backend e ignora `occupiedIntervals`. `404` y `400` → `not-found`; sin conexión, `5xx` o respuesta inválida → `error`.
- `frontend/src/app/slot-grid/complex-slots.page.*`: bloque de error y `retry()`.
- `frontend/src/app/slot-grid/slot-grid.builder.ts`: queda solo la disposición (`layoutFor`, `placementFor`).
- `frontend/src/app/complexes/complex-api.service.ts` y `complex.model.ts`: `listPublic()` y `PublicComplex {id, name, address, zone}`.
- `frontend/src/app/landing/club-directory.page.*`: estados cargando / error / vacío, zonas tomadas de los datos y filtro por zona exacta; una imagen genérica fija.
- `frontend/src/app/landing/landing.data.ts`: `ClubPreview` sin `complexId` (la home sigue con datos demo).
- `frontend/src/app/complexes/complex-admin-sidebar.component.*`: sin complejo por defecto; el enlace "Canchas" se oculta si no hay `complexId`.
- Eliminados: `slot-grid/demo-schedule.ts`, `complexes/complex-preview.store.*`, `bookings/booking-preview.store.*`.

## Validación

- Specs nuevos: `slot-grid.service.spec.ts` (URL y parámetro único, estados, `isPast`, `courtId`/`date`, 404/400, 0/500, respuesta inválida) y `club-directory.page.spec.ts` (lista, filtros, error con reintento, vacío).
- Adaptados: `complex-slots.page.spec.ts` (HTTP testing, error con "Reintentar"), `slot-grid.builder.spec.ts`, `landing.page.spec.ts` y `complex-admin-sidebar.component.spec.ts`.
- `npm test -- --watch=false` (141 pruebas) y `npm run build`.
- Búsqueda sin resultados de `DEMO_COURTS`, `demoScheduleFor`, `buildDayGrid`, `ComplexPreviewStore` y `BookingPreviewStore`.

## Límites de alcance

- Sin partidos pendientes ni clases hasta HU-09/HU-12: el backend solo emite `AVAILABLE|RESERVED|BLOCKED`. El reemplazo de partido pendiente de la página (`replacedSlotIds`) queda sin alcanzar porque no llegan turnos `pending`.
- `BLOCKED` equivale a un día deshabilitado en HU-04 (no hay bloqueo puntual).
- El directorio no muestra rating ni disponibilidad del día.
- La home (HU-00) sigue con datos demo.
- Reservar desde la grilla es HU-06 (frontend aún no integrado).
- `DemoRole` y el simulador de rol siguen en la administración de complejos: todavía los usa `complex-admin.page`; quitarlos queda para otra historia.
- En esta máquina (Node 25) las pruebas necesitan `NODE_OPTIONS=--no-experimental-webstorage`. El aviso de presupuesto de `complex-form.component.scss` ya existe en la base.
