# HU-12 · Reemplazar un partido pendiente

## Fases realizadas

1. Se precisó la regla: el reemplazo está permitido solo si el partido sigue incompleto y faltan menos de 4 horas para comenzar. A las 4 horas exactas continúa protegido.
2. Se añadió una acción en el resumen del turno pendiente, condicionada a esa ventana.
3. Se solicita confirmación antes del reemplazo y se muestra un aviso de éxito.
4. En la demo, el estado local cambia de partido pendiente a reservado.

## Archivos principales

- `frontend/src/app/bookings/booking.model.ts`: regla temporal pura del intervalo de reemplazo.
- `frontend/src/app/slot-grid/complex-slots.page.ts` y `.html`: habilitación, confirmación y estado local.
- `frontend/src/app/slot-grid/slot-summary.component.ts`: acción accesible en el resumen.
- `frontend/src/app/bookings/booking-preview.store.spec.ts`: prueba del límite de cuatro horas.

## Validaciones

- Build Angular y prueba unitaria de los límites temporales.
- Reinicio de los contenedores para probar la versión actualizada.

## Límites

- Los cambios son locales a la sesión de demostración; backend debe persistir la reserva y cancelar el partido pendiente de forma atómica.
- El envío real de notificaciones al organizador y jugadores requiere integración backend.
- Esta pantalla asume que el jugador ya cuenta con los cuatro integrantes, según la historia; no recopila nuevamente sus datos.
