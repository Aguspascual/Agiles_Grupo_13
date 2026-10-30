# HU-03 · Integración de canchas del complejo con la API

## Fases realizadas

1. Se verificó que la integración de HU-02 (complejos por API) estuviera mergeada en `Desarrollo`.
2. Se creó `feature/front-hu03-integrar-canchas` desde `origin/Desarrollo`.
3. Se reemplazó el store demo de canchas por un servicio HTTP y se adaptó la pantalla de administración.
4. Se mantuvieron operativas las pantallas de horarios (HU-04) y grilla pública (HU-05) sin tocar su dato demo propio.

## Archivos principales

- `frontend/src/app/courts/court-api.service.ts`: `GET/POST/PUT/DELETE /api/v1/complexes/{id}/courts` y señal `courts`.
- `frontend/src/app/courts/court-admin.page.*`: carga, alta, edición y baja contra la API, con toasts por código de error (400, 403, 404, 409, conexión).
- `frontend/src/app/courts/court-form*.ts`: se quitó el bloqueo permanente tras enviar; el doble envío se evita con `[saving]`/`disabled`.
- `frontend/src/app/courts/court-card.component.*`: sin estado de reservas futuras; el backend decide la baja con 409.
- `frontend/src/app/slot-grid/demo-schedule.ts`: `DEMO_COURTS` para la grilla pública (HU-05).
- `frontend/src/app/availability/court-availability.page.ts`: lee complejo y canchas desde la API.

## Validación

- Pruebas unitarias del servicio (cuerpo exacto de POST/PUT, baja, 409) y de la página (409 conserva la cancha, 400 mantiene el formulario abierto).
- `npm run build` del frontend.
- Búsqueda sin resultados de `CourtPreviewStore` y `hasFutureReservations` en `frontend/src`.

## Límites de alcance

- Sin cambios de backend.
- `hasFutureReservations` ya no se muestra porque el contrato del listado no lo expone.
- HU-04 (horarios) y HU-05 (grilla) siguen usando datos demo propios.
- Las pruebas de `availability-calendar` y del selector de canchas de HU-04 ya fallaban antes de este cambio.
