# HU-16 · Partido completo con invitaciones

Trello: [HU-16 · Partido completo con invitaciones](https://trello.com/c/AukuOvZ0)
Rama: `feature/hu16-partido-completo-invitaciones`

## Fase 1 · Regla y alcance

- Se reemplazó el alcance anterior de búsqueda global de turnos por creación de partidos privados para cuatro jugadores.
- El organizador elige cancha y horario, registra tres invitados por nombre (correo opcional) y obtiene enlaces personales para compartir.
- Las invitaciones duran 30 minutos desde la creación. Si faltan aceptaciones, la reserva se cancela y el horario se libera. Con las tres aceptaciones, el partido queda completo.
- Para elegir jugadores registrados, el creador escribe nombre o correo en un único campo; las sugerencias empiezan desde 6 caracteres, se limitan a 8 y muestran el correo parcialmente oculto. La invitación queda vinculada a la cuenta seleccionada.
- Se agregó RN-16 en `docs/REGLAS-NEGOCIO.md`.

## Fase 2 · Backend

- Migración `009_full_match_invitations.sql`: origen `full_match`, partidos privados, invitados, tokens almacenados como hash y vencimientos.
- `backend/internal/reservations/full_matches.go`: modelos, validación de solicitudes y creación atómica de la reserva privada.
- `backend/internal/reservations/full_match_invitations.go`: tokens, aceptación, consulta de estado y expiración transaccional.
- `backend/internal/reservations/full_matches_http.go`: endpoints de creación, consulta, invitación pública y aceptación; worker periódico para vencer reservas.
- `backend/internal/reservations/full_match_search.go`: búsqueda autenticada de jugadores con mínimo de 6 caracteres, máximo de 8 resultados y correo enmascarado.
- `backend/migrations/010_invitee_directory_search.sql`: vínculo de una invitación con la cuenta seleccionada.
- `backend/internal/reservations/service.go`, `backend/cmd/api/routes.go` y `backend/cmd/api/main.go`: registro de rutas y ejecución del worker.

## Fase 3 · Frontend

- `frontend/src/app/matches/full-match-api.service.ts`: contratos, búsqueda del directorio y validación de respuestas HTTP.
- `frontend/src/app/matches/create-match-dialog.component.ts`, `.html` y `.scss`: selección del modo privado, reserva y tres invitados.
- `frontend/src/app/matches/invitee-autocomplete.component.ts`, `.html` y `.scss`: campo único reutilizable, sugerencias y selección de cuenta.
- `frontend/src/app/matches/full-match-created.component.ts`, `.html` y `.scss`: copiar/enviar enlaces, estados de confirmación y vencimiento.
- `frontend/src/app/matches/full-match-invitation.page.ts`, `.html` y `.scss`: detalle de invitación, registro/inicio de sesión y aceptación.
- `frontend/src/app/app.routes.ts`: ruta pública de aceptación.
- `frontend/src/app/auth/register.page.ts`: conserva `returnUrl` al crear la cuenta desde la invitación.

## Validaciones y prueba manual

- La creación requiere tres nombres, teléfono de contacto, horario disponible futuro y al menos 30 minutos hasta el inicio.
- Si se selecciona una cuenta, solo esa persona puede aceptar; las invitaciones manuales con correo requieren coincidencia. Un usuario no puede ocupar dos lugares del mismo grupo.
- La búsqueda de jugadores exige entre 6 y 80 caracteres, requiere autenticación, excluye al jugador actual, limita resultados a 8 y no persiste las consultas.
- Los tokens tienen 256 bits aleatorios, se comparten una sola vez y se persiste solamente su hash.
- El worker ejecuta la expiración cada 10 segundos y también se ejecuta al consultar una invitación o su estado.
- Build Docker de Angular y Go ejecutado correctamente; la migración de búsqueda de invitados se registra como `010_invitee_directory_search.sql`.
- No se ejecutaron suites de tests.

## Límites

- No hay proveedor de envío de correo configurado: “Invitar por correo” abre el cliente de correo del dispositivo con el texto preparado. También se puede copiar cada enlace.
- Los enlaces de nombre sin correo los puede aceptar cualquier cuenta que tenga el enlace.
- No se agregan pagos ni cambios de reserva.
