# HU-04 · Integración de horarios disponibles con la API

## Fases realizadas

1. Se creó `feature/front-hu04-integrar-horarios` desde `origin/Desarrollo` (HU-01 a HU-03 ya integradas).
2. Se reemplazó el store local de horarios (`localStorage`) por un servicio HTTP sobre `…/courts/{courtId}/weekly-schedule/days`.
3. La pantalla de horarios carga los 7 días desde el backend y guarda día por día con control de revisión (`If-Match`).
4. Se retiró la acción de bloquear/liberar turnos y el simulador de rol; la grilla del día pasó a ser una vista previa de solo lectura derivada del horario guardado.
5. Se eliminó `AvailabilityPreviewStore`; la grilla pública (HU-05) genera sus turnos directamente desde su dato demo.

## Archivos principales

- `frontend/src/app/availability/schedule-api.service.ts`: `load` (siempre devuelve 7 reglas; días ausentes = no configurados) y `saveDay` (`PUT` con `If-Match: "<revision>"` si el día existe, `POST` si no). El cuerpo nunca lleva `id` ni `revision`.
- `frontend/src/app/availability/court-availability.page.*`: carga, guardado en serie solo de los días cambiados, un guardado a la vez (se conserva solo el último pendiente) y toasts por código de error (400, 403, 404, 409, 412, conexión). Tras un error recarga el horario real.
- `frontend/src/app/availability/availability-calendar.component.*`: vista de solo lectura, sin botones de bloqueo.
- `frontend/src/app/availability/availability.model.ts`: `WeeklyScheduleRule.revision` opcional.
- `frontend/src/app/slot-grid/slot-grid.service.ts`: usa `generateAvailabilitySlots` con `demoScheduleFor`.
- Eliminados: `availability-preview.store.ts` y su spec.

## Validación

- Pruebas del servicio (carga de 7 días, `POST` sin revisión, `PUT` con `If-Match` y nueva revisión) y de la página (solo días cambiados y en serie, último pendiente, 412 y 409 recargan, 400 no rompe el formulario, 403 al cargar).
- `npm test -- --watch=false` y `npm run build` del frontend.
- Búsqueda sin resultados de `AvailabilityPreviewStore`, `ComplexPreviewStore`, `DemoRole`, `toggleBlocked` y `padelmatch.availability` en `availability/` y `slot-grid/`.

## Límites de alcance

- Sin cambios de backend.
- El contrato no tiene bloqueo de turno puntual: la acción se eliminó y el criterio "Puedo bloquear un turno puntual" queda pendiente de backend.
- El guardado semanal se hace día por día (no hay endpoint masivo); un fallo intermedio deja guardados los días anteriores y se recarga el estado real.
- La grilla pública (HU-05) usa su dato demo hasta integrar `GET /slots`.
- En esta máquina (Node 25) `localStorage` del entorno de pruebas viene roto y hace fallar 10 archivos de spec ya en la base (auth, landing, app, slot-grid, availability). Se verificó con `NODE_OPTIONS=--no-experimental-webstorage`; no es un problema del código. Con ese ajuste, en la base fallaban solo 3 pruebas de `availability-calendar` y de la página (textos desactualizados), corregidas aquí.
