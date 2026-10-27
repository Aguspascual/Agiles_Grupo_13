# HU-16 · Búsqueda de turnos responsive

## Fases

1. Se revisó la tarjeta HU-16 de Trello y el flujo existente de `/partidos`.
2. Se creó `feature/front-hu16-buscar-turnos-responsive` desde `Desarrollo` actualizado.
3. Se adaptaron los filtros para móvil y se simplificó el encabezado de resultados.
4. Se añadió el detalle del partido desde la tarjeta y desde «Unirme al partido».
5. Se agregó un menú móvil de tres puntos con las secciones principales.
6. Se alineó el acceso a filtros junto al título en móvil y se ajustó el resumen y la ficha de jugadores del modal.
7. Se trasladó el cierre automático del toast a su propio componente.
8. Se integró el commit separado de HU-06 como base funcional del modal de creación.
9. Se conectó «Crear partido» del menú móvil al modal y se validó el diseño adaptativo existente.
10. Se compiló el frontend y se reinició el contenedor para revisión manual.

## Implementación

- Escritorio conserva el panel de filtros lateral.
- En móvil, el botón «Filtros» abre un diálogo con los mismos controles; el usuario puede limpiar, cerrar con Escape o tocar fuera.
- En móvil, el acceso a filtros conserva solo el ícono de embudo y una etiqueta accesible.
- Las tarjetas muestran el precio alineado a la derecha del nombre del complejo en móvil.
- Al seleccionar cualquier tarjeta o su acción, se abre el modal de detalle del partido; desde allí la solicitud para unirse requiere confirmación y se informa con un toast local.
- El encabezado móvil ofrece Inicio, Buscar partidos, Mis partidos, Clubes y Crear partido en un menú accesible por teclado.
- «Crear partido» en el menú móvil abre el modal HU-06 desde el servicio compartido; no navega a la búsqueda.
- El modal usa el viewport móvil completo, controles en columna y una zona de contenido desplazable con pie de acciones visible.
- El cuerpo del modal resume horario, ubicación y cantidad de jugadores en una tarjeta; en móvil aparece debajo del encabezado y antes del detalle. La ficha de jugadores se presenta en una sola columna.
- El toast administra su temporizador dentro del componente y se cierra automáticamente.
- Se eliminó el subtítulo con el total fijo, el indicador de zonas, la referencia a APA y el costo por jugador en resultados.
- Se retiró la barra superior de búsqueda, orden y selector de vista; los resultados quedan en cuadrícula.
- La búsqueda sigue usando datos locales de demostración y no integra backend.

## Validación y alcance

- La compilación Angular pasó y `git diff --check` no reportó problemas.
- La prueba focalizada `npm test -- --watch=false --include=src/app/landing/landing.page.spec.ts` pasó: 8/8.
- La suite completa pasó 94/99; quedan 5 fallos en pruebas existentes de HU-04 (agenda/selectores) y HU-06 (datos fijos de la cuenta), fuera del alcance HU-16.
- Los cambios se limitan al frontend y esta documentación de HU-16.
