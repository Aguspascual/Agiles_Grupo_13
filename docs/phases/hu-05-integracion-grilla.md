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

- **Partido abierto** y sus faltantes ya se ven (ver la sección siguiente). **Clase** sigue sin existir: el backend no tiene ese concepto y no emite `CLASS`. El reemplazo de un partido pendiente por un grupo completo es HU-12 (pendiente): se quitó el flujo demo local de la página de la grilla. Un deep-link desde la grilla a un partido concreto queda como mejora.
- `BLOCKED` equivale a un día deshabilitado en HU-04 (no hay bloqueo puntual).
- El directorio no muestra rating ni disponibilidad del día.
- La home (HU-00) sigue con datos demo.
- Reservar desde la grilla es HU-06 (frontend aún no integrado).
- `DemoRole` y el simulador de rol siguen en la administración de complejos: todavía los usa `complex-admin.page`; quitarlos queda para otra historia.
- En esta máquina (Node 25) las pruebas necesitan `NODE_OPTIONS=--no-experimental-webstorage`. El aviso de presupuesto de `complex-form.component.scss` ya existe en la base.

## Mejora: «Partido abierto» en la grilla (HU-05 y parte de HU-09)

El backend (TDD-0009 v3) ahora emite `PENDING_MATCH` con `pendingMatch {missingPlayers, level}` cuando un turno lo ocupa un partido abierto con lugares libres. Esta mejora lo consume.

### Fases

1. `slot-grid.service.ts`: se reemplazó el cast de `pendingMatch` por una validación estricta (`missingPlayers` entero de 1 a 3 y `level` de texto). Un `PENDING_MATCH` sin `pendingMatch` válido es un error de parseo y la página muestra el estado de error.
2. Se eliminó el flujo demo de HU-12 de la página, que no llamaba a ningún backend y habría simulado una cancelación inexistente: `replacedSlotIds`, `replacementNotice` y su timer, `replaceDialogOpen`, `canReplacePending`, `requestPendingReplacement`, `confirmPendingReplacement`, el diálogo `replacement-*` y sus estilos; en el resumen, el input `canReplacePending` y el output `replacePending`; en `bookings/booking.model.ts`, `isPendingReplacementWindowOpen` (se conserva `PendingMatchInfo`). El token `CLOCK` se mantiene: lo usan la grilla y la agenda.
3. `slot-summary.component.ts`: con sesión, un turno `pending` lleva a `/partidos` ("Ver partidos abiertos") y uno `available` a `/partidos?crear=1` ("Reservar este turno"); sin sesión sigue llevando a `/ingresar`. El resumen del turno pendiente muestra «Faltan N jugadores · nivel X».

### Archivos principales

- `frontend/src/app/slot-grid/slot-grid.service.ts`, `complex-slots.page.{ts,html,scss}`, `slot-summary.component.ts`.
- `frontend/src/app/bookings/booking.model.ts`.
- Specs: `slot-grid.service.spec.ts` (pendiente válido, ocho variantes inválidas), `complex-slots.page.spec.ts` (turno pendiente seleccionable, resumen, sin botón ni diálogo de reemplazo, CTA con sesión, error por dato inválido) y `slot-summary.component.spec.ts` (CTA con y sin sesión).

### Validación

- Pruebas de `slot-grid/` en verde (`NODE_OPTIONS=--no-experimental-webstorage`) y `npm run build` sin errores nuevos (los avisos de presupuesto ya existían).
- Suite completa: en esta máquina fallan por el entorno (`localStorage`, `TestBed` ya instanciado) las specs de `app`, `auth`, `landing`, `complexes`, `club-directory`; ya fallaban en `Desarrollo` antes de este cambio y no son de la grilla.
- Verificación de punta a punta contra el backend de la PR #50: ver el cuerpo de la PR del frontend.

### Límites

Solo `slot-grid/`, `bookings/booking.model.ts` y docs. No se tocaron `agenda/`, `matches/`, `reservations/` ni `landing/`. Sin backend, migraciones ni Docker. Las animaciones existentes no cambian (no se agregaron nuevas).