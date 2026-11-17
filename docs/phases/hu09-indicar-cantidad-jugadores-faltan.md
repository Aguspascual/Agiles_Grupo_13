# HU-09 Parte 2: indicar cuántos jugadores faltan

## Fases realizadas

1. Se leyó la tarjeta de Trello y se contrastó con la creación, búsqueda, detalle, agenda y reservas propias existentes.
2. Se agregó a la creación de partidos abiertos la asignación visual de los lugares de cancha: el creador elige su posición y puede sumar amigos con cuenta o invitados sin cuenta desde los lugares disponibles.
3. Los amigos registrados se agregan como participantes del partido; los invitados sin cuenta se guardan con nombre y posición. Hasta tres acompañantes pueden ocupar lugares: con dos amigos queda un lugar abierto y al ocupar el cuarto lugar el partido se marca completo.
4. La cantidad de lugares libres se calcula con participantes registrados e invitados. Los nombres y posiciones se muestran en búsqueda, detalle y agenda.
5. Se actualizó la unión al partido para no superar cuatro ocupantes y pasar a estado completo cuando ya no quedan lugares libres.
6. Se propagó el conteo a las tarjetas y detalle públicos, a la grilla pública, a la agenda del complejo y a “Mis partidos”.
7. Se agregaron las migraciones `015_pending_match_guest_players.sql` y `018_pending_match_guest_names.sql`; las reservas abiertas históricas se normalizan porque su valor anterior de acompañantes era un valor fijo, no un conteo real.
8. Se agregó un selector de posición para ambos tipos de partido. En los abiertos se guarda en la inscripción del organizador; en los completos, en el registro del partido. Las migraciones `016_pending_match_player_position.sql` y `017_full_match_organizer_position.sql` agregan los campos por partido.

## Archivos principales

- Backend: `internal/matches`, `internal/slots`, `internal/agenda`, `internal/reservations`.
- Base de datos: `migrations/015_pending_match_guest_players.sql`.
- Base de datos: `migrations/016_pending_match_player_position.sql`.
- Base de datos: `migrations/017_full_match_organizer_position.sql`.
- Base de datos: `migrations/018_pending_match_guest_names.sql`.
- Frontend: creación y detalle de partidos, tarjetas, agenda y servicio/modelo de reservas propias.

## Verificación y límites

- Las imágenes Docker de frontend y backend compilaron correctamente.
- El stack `agiles_grupo_13` quedó saludable en `http://localhost:8081` (front) y `http://localhost:8000` (API); las migraciones 015 a 018 figuran aplicadas.
- No se ejecutaron pruebas automatizadas.
- Los invitados sin cuenta quedan asociados al partido por nombre y lugar; no se crea una cuenta ni un perfil para ellos.
- La posición seleccionada se guarda por partido y no reemplaza la preferencia del perfil. En partidos abiertos se muestra en el detalle; en partidos completos, en la confirmación de creación.
- Los amigos con cuenta se agregan como participantes confirmados del partido; no se inicia el flujo de invitación de HU-16 desde estos lugares.
