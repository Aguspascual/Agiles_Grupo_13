# HU-13 · Bajarse de un partido pendiente

## Fases realizadas

1. Se revisó la tarjeta de Trello: HU-13 trata de liberar el lugar de un jugador anotado en un partido pendiente, no de cancelar el turno alquilado.
2. Se preparó un mockup en `/partidos` de un partido completo (4/4) con el jugador actual incluido.
3. La acción “Bajarme del partido” solicita confirmación y, al aceptar, devuelve el estado a 3/4 y muestra un lugar libre.
4. La confirmación visual informa que se avisará al grupo; el envío real queda pendiente de backend.

## Archivos principales

- `frontend/src/app/bookings/pending-match-membership.store.ts`: estado local de demostración.
- `frontend/src/app/bookings/pending-match-membership-card.component.ts` y `.scss`: tarjeta, modal de confirmación y aviso.
- `frontend/src/app/landing/match-search.page.ts` y `.html`: integración en Buscar partidos.
- `frontend/src/app/bookings/pending-match-membership.store.spec.ts` y `frontend/src/app/landing/landing.page.spec.ts`: cobertura de estado y flujo.

## Validaciones

- Pruebas dirigidas de estado inicial, cancelación del diálogo y baja confirmada.
- Build del frontend.
- Reinicio del contenedor frontend para prueba manual.

## Límites de alcance

- Los datos se mantienen en memoria para la demo; recargar restablece el ejemplo.
- La persistencia de membresía, consistencia de plazas y notificaciones reales requieren backend.
- No se cancela la reserva del turno de la cancha.
