# HU-04 — Refinamiento de horarios y experiencia de uso

## Objetivo

Reducir la densidad visual de la administración de canchas y horarios, y permitir definir más de una franja de apertura por día. El encargado debe poder revisar la disponibilidad de una fecha y modificar reglas semanales sin recorrer una lista larga ni depender de botones de guardar.

Este diseño refina la implementación frontend existente de HU-04. Respeta la separación del equipo: no incluye endpoints, backend, cambios de base de datos ni servicios adicionales.

## Decisiones de producto

1. Cada cancha tendrá una regla para cada día de la semana. Una regla habilitada contendrá una o más franjas horarias, por ejemplo 09:00–13:00 y 17:00–22:00, más una duración común para sus turnos: 60 o 90 minutos.
2. Las franjas deben tener inicio anterior al cierre, admitir al menos un turno completo y no superponerse entre sí. Los turnos se calculan dentro de cada franja y nunca la exceden.
3. El encabezado de la pantalla mostrará «Horarios disponibles» y el selector de cancha. Se quitan la ruta de migas y la etiqueta «Demo local».
4. La configuración semanal se mostrará en un acordeón cerrado inicialmente. Dentro se podrán expandir los días, activar o desactivar su regla, agregar o quitar franjas y elegir la duración.
5. Los cambios válidos se guardarán automáticamente en `localStorage` después de una pausa breve al terminar la edición. No habrá botones Guardar ni Cancelar. Los valores inválidos permanecerán editables, mostrarán errores asociados a sus campos y no reemplazarán la última configuración válida.
6. La agenda mostrará una sola fecha, comenzando por hoy. Flechas accesibles permitirán navegar por fecha; no se generará una ventana limitada a 28 días ni se mostrará contador de turnos. La fecha anterior a hoy estará deshabilitada.
7. La pantalla conservará el fondo oscuro, las tarjetas claras, el diseño responsive, el foco visible y el respeto a `prefers-reduced-motion`.
8. Las acciones de cada tarjeta de cancha se agruparán detrás de un control compacto «Acciones» con las opciones Horarios, Editar y Dar de baja. El menú debe poder utilizarse con teclado y anunciar su estado.

La referencia visual de Stitch es la pantalla existente «Panel de Club - Dashboard & Grilla de Canchas - PádelMatch La Plata». La nueva pantalla de horarios debe conservar esa identidad y priorizar una vista compacta de la fecha, dejando las reglas semanales en el acordeón.

## Recomendación para la persistencia futura

No se materializará una fila por cada turno futuro. El modelo fuente de verdad debería guardar reglas recurrentes por cancha/día y franjas; los turnos se calculan al consultar una fecha. La persistencia remota debería almacenar reservas reales y excepciones puntuales, como bloqueos o cierres especiales. La operación de reservar deberá validar y ocupar el intervalo de forma atómica para impedir dobles reservas.

Esta HU solo implementará el cálculo por fecha y la persistencia de demostración local. No cambiará ni diseñará migraciones de base de datos. La recomendación anterior queda como guía para la futura integración backend.

## Modelo frontend propuesto

- `WeeklyScheduleRule`: día de semana, estado activo, duración y colección de franjas.
- `ScheduleInterval`: identificador local estable, hora de inicio y hora de cierre.
- `AvailabilitySlot`: turno calculado para una fecha y franja, con identificador estable y estado disponible/bloqueado.
- El generador recibirá una fecha concreta y producirá únicamente sus turnos. Bloqueos locales seguirán identificando la cancha, fecha y hora de inicio.

## Persistencia y migración de la demo

- Guardar el esquema nuevo en la clave `padelmatch.availability.v2` con `version: 2`.
- Al inicializar, leer v2; si no existe, leer `padelmatch.availability.v1`, migrar y escribir v2. Mantener la clave v1 intacta como respaldo.
- Migrar el formato v1: por cada día activo, convertir `opensAt`/`closesAt` en una franja; conservar duración y estados de bloqueo cuyos identificadores sigan siendo válidos.
- Validar datos al leerlos. Ante contenido malformado o incompatible, usar reglas demo seguras sin bloquear la pantalla.
- Guardar solo después de una edición válida. Si `localStorage` no está disponible, continuar en memoria y avisar con un estado no bloqueante.

## Componentes y responsabilidades

- `availability.model.ts`: reglas semanales, franjas e intervalos calculados.
- `availability-generator.ts`: validación pura, generación para una fecha local y exclusión de turnos parciales/superpuestos.
- `availability-preview.store.ts`: migración v1→v2, lectura, guardado local y bloqueos de la demo.
- `weekly-schedule-form.component.*`: editor compacto con acordeón, franjas múltiples, validación y autosave.
- `availability-calendar.component.*`: turnos de la fecha seleccionada y emisión de solicitudes para bloquear/liberar.
- `court-availability.page.*`: navegación de fecha, selección de cancha, coordinación del guardado y mensajes breves.
- `court-card.component.*`: menú compacto de acciones.

Mantener cada responsabilidad acotada; reutilizar controles existentes si encajan y evitar agregar dependencias.

## Errores y accesibilidad

- Asociar cada error de franja a sus campos y conservar el último valor persistido válido.
- Indicar el resultado del autoguardado con un mensaje breve y no intrusivo; no emitir un toast por cada pulsación.
- Dar nombre accesible a controles de agregar/quitar franja y navegar fecha; impedir eliminar la última franja sin una alternativa para desactivar el día.
- El menú de cancha debe cerrarse con Escape y al elegir una acción; conservar estados de foco claros.
- El estado disponible/bloqueado debe tener texto, no depender únicamente del color.
- Reducir o eliminar las transiciones cuando `prefers-reduced-motion` esté activo.

## Criterios de aceptación

1. Se pueden configurar en un mismo día dos o más franjas válidas, como 09:00–13:00 y 17:00–22:00, con turnos de 60 o 90 minutos.
2. Una franja inválida, una franja solapada o una franja sin turno completo no se guarda y se explica junto al control relacionado.
3. Una modificación válida se persiste automáticamente; tras recargar, el horario sigue disponible sin botón Guardar.
4. La configuración guardada en v1 se migra conservando el horario y duración existentes.
5. La agenda presenta únicamente la fecha seleccionada y permite avanzar más allá del antiguo límite de 28 días. Sus turnos se calculan solo para esa fecha.
6. Bloquear/liberar un turno actualiza la fecha visible y persiste la excepción de demostración.
7. La tarjeta de cancha presenta un menú de acciones usable con teclado y que no desborda el ancho disponible.
8. En la pantalla de horarios no aparecen las migas, «Demo local», la frase auxiliar anterior, «Cambios guardados en este navegador», los contadores de turnos ni los botones Guardar/Cancelar.
9. Las vistas siguen siendo utilizables en móvil y escritorio, no producen scroll horizontal y respetan `prefers-reduced-motion`.
10. Se actualizan la documentación de HU-04 y los tres ítems de Frontend en Trello tras verificar la implementación; el checklist Backend permanece intacto.

## Fuera de alcance

- Backend, endpoints, base de datos, autenticación/autorización real y reservas compartidas.
- Disponibilidad sincronizada entre usuarios o dispositivos.
- Excepciones futuras de mantenimiento/cierre remoto; la demo solo persiste sus bloqueos locales actuales.
- Cambios generales de diseño fuera de las tarjetas de canchas y la pantalla de horarios.
