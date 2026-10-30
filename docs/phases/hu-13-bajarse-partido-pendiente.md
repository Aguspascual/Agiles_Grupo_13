# HU-13 · Bajarse de un partido pendiente

## Fases realizadas

1. Se revisó la tarjeta de Trello: HU-13 trata de liberar el lugar de un jugador anotado en un partido pendiente, no de cancelar el turno alquilado.
2. Se preparó un mockup en `/partidos` de un partido completo (4/4) con el jugador actual incluido.
3. La rama integra la baja persistente por medio de `DELETE /api/v1/matches/{matchId}/players/me`; pueden usarla tanto organizadores como jugadores y se mantiene el límite de dos horas antes del inicio.
4. El detalle del partido y la tarjeta de partido en “Mis partidos” solicitan confirmación antes de enviar la baja a la API.
5. Después de una baja exitosa se actualizan los datos desde el servidor y se muestra un toast; un partido completo vuelve a estar abierto al quedar un lugar libre.
6. Si se baja la última persona, el partido se elimina, la reserva se marca cancelada para liberar el turno y el servidor responde `{ "deleted": true }`.
7. El modal explica esta consecuencia antes de confirmar cuando la persona actual es la última anotada.
8. El estado de la búsqueda, del modal, del botón y del toast usa señales para actualizar la interfaz al recibir respuestas HTTP en Angular zoneless.

## Archivos principales

- `frontend/src/app/bookings/pending-match-membership.store.ts`: estado local de demostración.
- `frontend/src/app/bookings/pending-match-membership-card.component.ts` y `.scss`: tarjeta, modal de confirmación y aviso.
- `frontend/src/app/landing/match-search.page.ts` y `.html`: integración en Buscar partidos.
- `frontend/src/app/bookings/pending-match-membership.store.spec.ts` y `frontend/src/app/landing/landing.page.spec.ts`: cobertura de estado y flujo.
- `frontend/src/app/matches/match-api.service.ts`: llamada DELETE autenticada al endpoint de baja.
- `frontend/src/app/landing/match-detail-dialog.component.*`: confirmación, estados de jugador y acción desde el detalle.
- `frontend/src/app/landing/match-search.leave.spec.ts`: regresión para verificar que, tras la respuesta de baja, se cierra el modal y aparece el toast.
- `frontend/src/app/landing/match-search.page.ts` y `.html`: señales reactivas para cerrar el modal, finalizar el estado de procesamiento, quitar el partido eliminado de la lista y mostrar el resultado.
- `frontend/src/app/reservations/my-reservation-card.component.*` y `my-reservations.page.*`: baja de partidos propios desde Mis partidos.
- `backend/internal/matches/postgres.go` y `backend/internal/matches/service.go`: operación transaccional para baja del organizador/jugador y eliminación del partido sin miembros.
- `backend/cmd/api/match_leave_http_test.go`: validación de baja del organizador y eliminación del último partido, con liberación de reserva.

## Validaciones de la integración

- `npm run build` del frontend.
- `npx ng test --runner-config=vitest.config.ts --include=src/app/landing/match-search.leave.spec.ts` (1 prueba focalizada).
- Prueba HTTP de backend para baja del último jugador, eliminación del partido y liberación de la reserva.
- Se recrearon los contenedores Docker para habilitar la prueba contra la API y la base local.
- Los avisos internos se generan para quienes permanecen anotados; cuando se va la última persona no quedan destinatarios.

## Límites de alcance

- El bloque local de demostración anterior ya no participa en este flujo integrado.
- No se agregan endpoints ni migraciones; se ajusta la operación existente del endpoint de baja.
- No se implementan correo ni WhatsApp; los avisos quedan en el sistema.
- Solo se libera el turno si ya no queda ningún integrante; la baja individual conserva la reserva y deja abierto el cupo.
