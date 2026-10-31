# Mejora: modal "Crear nuevo partido"

Rama: `mejora/frontend-ajustes-visuales`. Incluye cambios de backend porque dos de los pedidos (varios niveles y lugar en la cancha) necesitan guardar datos nuevos.

## Fases

1. **Encabezado.** Se quitó "PádelMatch · La Plata" y queda solo el título.
2. **Selectores.** Complejo, cancha y horario disponible usan el selector del sistema (`app-select-menu`, ahora con `placeholder` y estado deshabilitado). El horario muestra "Sin turnos libres" cuando no hay.
3. **Fecha.** El ícono del calendario es negro.
4. **Invitados.** El autocompletado no ofrece al organizador ni a quien ya fue elegido en otro lugar (`excludedIds`).
5. **Lugar en la cancha (partido abierto).** Nuevo selector `app-court-position-picker`: una cancha con dos parejas y los lugares Drive y Revés; viene preseleccionado según la posición del perfil. El lugar se guarda y la ficha del partido ubica a cada jugador donde eligió; quien se suma toma el primer lugar libre.
6. **Nivel buscado.** Selector múltiple (`app-multi-select` con `max`) de hasta tres niveles. La lista de partidos, el filtro por nivel y las recomendaciones consideran todos los niveles.
7. **Botón Cancelar** con estilo propio (antes se veía negro).

## Backend

- Migración `014`: `pending_matches.extra_levels` (hasta dos niveles más, validados) y `pending_match_players.slot` (1 a 4, único por partido).
- `POST .../matches` acepta `targetLevels` (1 a 3, sin repetir) y `slot` (0 a 4); `targetLevel` sigue funcionando. Las respuestas incluyen `targetLevels` y el `slot` de cada jugador. El filtro `level` coincide con cualquier nivel buscado.
- Agenda, mis reservas y la grilla pública muestran los niveles unidos con " / ".

## Archivos principales

- Backend: `migrations/014_*.sql`, `internal/matches/{model,postgres}.go`, `internal/agenda/pending.go`, `internal/reservations/own_list.go`, `internal/slots/postgres.go`
- Frontend: `matches/create-match-dialog.component.*`, `matches/court-position-picker.component.*`, `matches/invitee-autocomplete.component.*`, `matches/match-api.{model,mapper}.ts`, `shared/{select-menu,multi-select}.component.*`, `landing/match-detail-dialog.component.*`, `landing/{landing.page,match-search.page}.ts`

## Validaciones

- `go vet` y `go test ./...`: correctos (incluye validación de niveles y lugar).
- Pruebas Angular de matches, shared y landing (salvo `landing.page.spec.ts`, que ya fallaba en la base de la rama).
- Con la API real: partido con tres niveles y lugar 3; el filtro `level` encuentra el nivel secundario; niveles repetidos dan 400; un segundo jugador que se suma toma el lugar 1.
- Revisión visual en Chrome a 800x600 y 1920x1080.

## Límites de alcance

- Quien se suma a un partido no elige lugar: toma el primero libre.