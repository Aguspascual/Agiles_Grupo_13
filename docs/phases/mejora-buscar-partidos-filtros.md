# Mejora: tarjeta de filtros de Buscar partidos

Rama: `mejora/frontend-ajustes-visuales`. Alcance: solo frontend, sin cambios de lógica de filtrado.

## Fases

1. **Encabezado de la tarjeta.** Título, contador de filtros activos (verde si hay, gris si no; singular/plural) y "Limpiar filtros", con una línea separadora.
2. **Solo con lugares libres.** Pasó de checkbox a interruptor con título y descripción, y borde verde cuando está activo.
3. **Zona y características de cancha.** Ahora son botones tipo "chip" que se marcan en verde; antes eran listas de checkboxes con mucho espacio entre filas (el estilo global `.check-row` agregaba margen).
4. **Fecha y nivel.** Chips del mismo estilo.
5. **Horario preferido.** Filas con casilla propia y resaltado al elegirlas.
6. **Club específico.** Selector con flecha propia y foco visible.
7. **Segunda pasada.** Se quitaron el contador de filtros activos del encabezado y el interruptor Solo con lugares libres (con su lógica). **Club específico** ahora lista los complejos registrados en la base de datos (GET /api/v1/public/complexes), no solo los clubes con partidos publicados, y usa el selector propio del sistema (pp-select-menu, con tamaño configurable por variables CSS). El contador sobre el ícono de filtros del modo móvil se mantiene.
8. Secciones separadas por líneas y tipografía más legible. Foco visible en todos los controles y transiciones desactivadas con `prefers-reduced-motion`.

## Archivos principales

- `frontend/src/app/landing/match-search.page.html`
- `frontend/src/styles/_match-search.scss`

## Validaciones

- Pruebas Angular de búsqueda y detalle de partidos: en verde.
- Revisión visual en Chrome a 800x600 y 1920x1080; se comprobó que elegir zona, horario, nivel y el interruptor actualiza los controles y el contador.
- El modo móvil (menos de 700px) conserva el modal de filtros existente.

## Límites de alcance

- No se tocó backend ni la lógica de filtrado.