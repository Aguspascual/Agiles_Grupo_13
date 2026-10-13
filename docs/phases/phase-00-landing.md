# HU-00 · Landing pública

## Fases realizadas

1. **Relevamiento:** se tomaron como referencia las capturas de Stitch `Home` y `Home 2`. Se mantuvieron las secciones de búsqueda, partidos y navegación pública, y se agregó la pantalla `Clubes`.
2. **Home:** se ajustó el tamaño visual cerca de un 20%, se retiró el rótulo de filtrado de categoría y el de comunidad, se actualizó `CLUBES ASOCIADOS` y se reemplazó la afirmación de verificación por el rango de categorías disponibles (`2da a 8va`). Las tarjetas de partidos recomendados y disponibles incluyen fotos locales de cancha.
3. **Buscar partidos:** se retiró el rótulo de matchmaking y el resumen de Hoy, categoría y clubes activos. Se redujo el espacio entre el header y el título; las tarjetas mantienen sus fotografías locales con texto alternativo.
4. **Clubes:** se creó la ruta pública `/clubes`, con búsqueda por club/localidad, filtro por zona, tarjetas con fotos y acceso a los partidos de cada club. Se retiró el rótulo `CLUBES DE LA PLATA` y se unificó la escala visual del header con Inicio y Buscar partidos. Se reutilizan datos y recursos locales del frontend; no requiere iniciar sesión.
5. **Accesos de demo:** se quitó la tarjeta de accesos de Home y se agregaron las rutas disponibles a la descripción de la tarjeta compartida HU-00 en Trello. Se preservó la descripción y se marcaron completos los puntos de réplica de Home y Home 2; los ítems que requieren integración con Back siguen pendientes.
6. **Responsive y accesibilidad:** se conservan puntos de corte para móvil/tablet/escritorio, imágenes con `alt`, etiquetas en los controles, estados vacíos y animaciones compatibles con `prefers-reduced-motion`.
7. **Validación:** las 7 pruebas focalizadas HU-00 pasan y la compilación de producción finaliza con un bundle inicial de 495.18 kB. Se reconstruyó y levantó solo el contenedor `frontend`. En esta corrección se comprobaron `/`, `/partidos` y `/clubes` en escritorio; las fotos de los partidos se muestran y los rótulos y contadores indicados ya no aparecen. La revisión responsive previa comprobó las rutas en 375 px y 320 px; no se repitió en esta corrección porque la sesión del navegador no permitió cambiar el viewport. La búsqueda local de clubes y el acceso de City Bell a un partido compatible también se probaron. La suite completa mantiene tres fallas preexistentes de HU-04 (`availability-calendar.component.spec.ts` y `court-availability.page.spec.ts`). La app está disponible en `http://localhost:8081`, según `docker-compose.yml`.

## Archivos principales

- `frontend/src/app/landing/landing.page.*`: Home, filtros y contenidos principales.
- `frontend/src/app/landing/match-search.page.*`: Home 2 y búsqueda de partidos.
- `frontend/src/app/landing/club-directory.page.*`: directorio público de clubes.
- `frontend/src/app/landing/landing.data.ts`: datos locales de clubes, partidos e imágenes.
- `frontend/src/app/landing/match-card.component.*`: tarjeta reutilizable de partido.
- `frontend/src/app/landing/club-card.component.*`: tarjeta de club en Home.
- `frontend/src/app/landing/landing-header.component.*` y `landing-footer.component.*`: navegación compartida.
- `frontend/src/styles/_landing.scss`, `_match-search.scss` y `club-directory.page.scss`: estilos adaptables de las pantallas.
- `frontend/src/app/landing/landing.page.spec.ts`: pruebas de contenido, navegación y filtros.
- `frontend/src/app/app.routes.ts`: rutas públicas y carga diferida de Clubes.

## Alcance y límites

- Frontend solamente. No se agregaron servicios, APIs, backend, base de datos ni persistencia.
- Partidos, precios, reseñas, disponibilidad, métricas y clubes son datos ilustrativos. La integración real sigue en el checklist Backend de la tarjeta HU-00.
- La búsqueda y filtros de `/clubes` y `/partidos` son locales. El CTA de creación dirige a Buscar partidos hasta que exista su flujo.
- `Mis partidos` permanece fuera de HU-00 y corresponde a HU-17.
- Mensaje de commit sugerido: `HU-00: mejorar landing y sumar pantalla pública de clubes`.
