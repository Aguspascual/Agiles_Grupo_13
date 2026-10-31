# Mejora: Mis Partidos, Inicio y agenda del administrador

Rama: `mejora/frontend-ajustes-visuales`. Solo frontend.

## Fases

1. **Mis Partidos.** Se quitaron los enlaces "Explorar partidos" y "Ver clubes" del estado vacío en Próximos (antes ya se habían quitado en Jugados).
2. **Agenda del administrador.** Al presionar un turno reservado o con partido pendiente, el detalle se abre en un modal (con la foto de la cancha, contacto, origen, jugadores anotados y "Cancelar reserva") en lugar del panel en línea. Se cierra con la X, Escape o al presionar fuera.
3. **Inicio (jugador).** "Partidos recomendados para vos" y "Partidos disponibles en La Plata" usan la misma tarjeta que Buscar partidos: con la foto de la cancha y, al presionarla, el modal de detalle (con unirse y bajarse).
4. **Foto de la cancha.** Las tarjetas y el modal de partido usan la foto real de la cancha (`/api/v1/public/courts/{id}/image`); si no tiene, una imagen genérica.

## Archivos principales

- `frontend/src/app/agenda/agenda.page.{html,ts,scss}`
- `frontend/src/app/landing/landing.page.{html,ts}`, `match-card.component.ts`, `match-detail-dialog.component.*`
- `frontend/src/app/matches/match-api.mapper.ts`, `frontend/src/app/reservations/my-reservations.page.html`

## Validaciones

- Pruebas Angular de agenda, partidos, reservas e integración de landing (la prueba que exigía que Inicio no mostrara imagen se invirtió).
- Revisión visual a 800x600 y 1920x1080 con usuarios de prueba (ya eliminados).

## Límites de alcance

- El modal del administrador es de solo lectura salvo cancelar; no permite unirse a partidos.