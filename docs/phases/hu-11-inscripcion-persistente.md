# HU-11 · Inscripción persistente y búsqueda sin filtros iniciales

## Fases realizadas

1. Se actualizó la rama local desde `origin/Desarrollo` y se creó `hu11-front-back-inscripcion-persistente`.
2. Se reprodujeron ambos problemas con pruebas de regresión: filtros seleccionados al abrir la búsqueda y ausencia de estado visual para una cuenta que ya participa.
3. La búsqueda ahora inicia sin zona, nivel, fecha ni horario aplicados. La sesión se restaura antes de cargar los partidos para que la identidad esté disponible al renderizar.
4. El detalle compara el nombre de la cuenta con los participantes del partido devueltos por la API. Si coincide, muestra “Ya estás inscripto en este partido” y oculta la acción para volver a anotarse.

## Archivos principales

- `frontend/src/app/landing/match-search.page.ts`: valores iniciales sin filtros, lectura de sesión antes de consultar partidos y eliminación de filtros automáticos por query string.
- `frontend/src/app/landing/match-detail-dialog.component.ts`: detección del usuario actual entre los participantes.
- `frontend/src/app/landing/match-detail-dialog.component.html` y `frontend/src/styles/match-detail.scss`: confirmación visual y marca de la persona inscripta.
- `frontend/src/app/landing/match-search.hu11.spec.ts` y `frontend/src/app/landing/match-detail-dialog.hu11.spec.ts`: cobertura de regresión.

## Validaciones

- Pruebas enfocadas HU-11: 2 aprobadas.
- Build de producción: aprobado; quedan avisos de presupuesto preexistentes en bundles y estilos.
- Suite completa: 137 aprobadas y 9 fallidas en 3 archivos de pruebas preexistentes (`app.spec.ts`, `auth.guard.spec.ts`, `landing.page.spec.ts`). Las fallas existentes corresponden a expectativas desactualizadas de autenticación, Home y datos demo; las dos pruebas HU-11 pasan.
- Docker: contenedores del stack reconstruidos y reiniciados después del cambio.

## Alcance y límite de integración

Los cambios de código son únicamente frontend; se consume la lista de partidos y participantes que ya entrega la API. El contrato actual no expone el identificador del jugador dentro de cada participante, por lo que la identidad se coteja por nombre completo o nombre visible abreviado. Si existen dos personas con el mismo nombre visible, la API deberá exponer el identificador del jugador para eliminar esa ambigüedad.
