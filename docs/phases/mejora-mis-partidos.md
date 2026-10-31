# Mejora: página "Mis Partidos"

Rama: `mejora/frontend-ajustes-visuales`.

## Fases

1. Título con el mismo tamaño y ancho que "Buscar Partidos", sin espacio con el header; textos y tarjetas más compactos.
2. Las pestañas "Próximos" y "Jugados" quedan a la derecha del título.
3. Se quitó el borde superior verde de las tarjetas.
4. Al presionar un partido se abre el mismo modal de detalle de "Buscar Partidos" (también con Enter). Los botones de la tarjeta no abren el modal. Desde el modal se puede bajar del partido.
5. "Próximo turno" muestra una cuenta regresiva en días y horas:minutos, que se actualiza sola.
6. Corrección en el modal: la pareja A queda en la columna izquierda y la B en la derecha, y "Fecha y hora" ya no repite "hs".
7. Cada tarjeta muestra la foto de la cancha (GET /api/v1/public/courts/{id}/image); si la cancha no tiene foto, se usa una imagen genérica.

## Backend

- `GET /api/v1/matches/{matchId}`: devuelve un partido (abierto, completo o jugado) solo a quienes participan; 404 para los demás y 401 sin sesión. Hace falta porque el listado público solo trae partidos abiertos y futuros.

## Archivos principales

- `frontend/src/app/reservations/my-reservations.page.*`, `my-reservations-summary.component.*`, `my-reservation-card.component.scss`
- `frontend/src/app/matches/match-api.service.ts`, `frontend/src/app/landing/match-detail-dialog.component.*`, `frontend/src/styles/match-detail.scss`
- `backend/internal/matches/{model,service}.go`, `backend/cmd/api/routes.go`

## Validaciones

- `go vet` y `go test ./...` correctos; pruebas Angular de reservas, partidos y landing.
- Con la API real: el participante ve el partido, un ajeno recibe 404 y sin sesión 401.
- Revisión visual a 800x600 y 1920x1080.

## Límites de alcance

- Solo los partidos con reserva vigente abren el detalle; los cancelados no.