# Diseño HU-04 — Configurar horarios disponibles

## Estado y fuentes

- Historia vigente: **HU-04: Configurar horarios disponibles**, según la rama `HU-04--Configurar-horarios-disponibles` y la tarjeta de Trello.
- Referencias visuales de Google Stitch: **Canchas & Tarifas - Panel de Club** y **Reservas & Turnos - Panel de Club**.
- Hay documentación anterior que llama HU-04 a “Publicar partido”. Se considera obsoleta frente a la historia y la rama vigentes; se corregirá al actualizar la documentación de HU-04.

## Objetivo

Permitir que un encargado configure los horarios recurrentes de una cancha, revise los turnos generados para las próximas semanas y bloquee o libere turnos individuales. El resultado debe poder probarse manualmente en el frontend sin servicios de backend.

## Alcance funcional

1. Entrar desde la administración de canchas a una pantalla dedicada a horarios de una cancha.
2. Definir por cada día de la semana si está habilitado, la hora de apertura, la hora de cierre y la duración del turno (60 o 90 minutos).
3. Validar que las horas sean válidas, que el cierre sea posterior a la apertura, y que el intervalo admita al menos un turno completo.
4. Guardar la configuración y generar visualmente los turnos de las próximas cuatro semanas. Los turnos deben alinearse a la apertura y no extenderse más allá del cierre.
5. Bloquear o desbloquear un turno puntual e indicar su estado de manera perceptible y accesible.
6. Mostrar estados vacíos, confirmación/toast al guardar y al bloquear/liberar, y mensajes de validación junto al control que requiere atención.

## Experiencia e interfaz

- Crear una vista dedicada por cancha, navegable desde **Canchas & Tarifas**. El nombre de la cancha debe permanecer visible y el cambio de cancha debe ser sencillo.
- Mantener la separación visual de Stitch: configuración semanal para reglas recurrentes y una agenda para fechas/turnos puntuales, inspirada en **Reservas & Turnos**.
- Conservar el sistema visual ya aplicado a la administración: fondo oscuro, superficies/tarjetas claras, jerarquía tipográfica y controles consistentes. Adaptar la agenda a pantallas pequeñas sin exigir scroll horizontal de toda la página.
- Mostrar los días y horarios mediante controles semanales claros; presentar los turnos agrupados por fecha, con estado y acción explícitos.
- Usar transiciones breves y respetar `prefers-reduced-motion`; la animación no debe retrasar la interacción.
- Controles utilizables con teclado, etiquetas accesibles, foco visible y contraste suficiente. El estado no dependerá solo del color.

## Diseño técnico del frontend

- Mantener Angular standalone y Reactive Forms.
- Separar la página contenedora, el editor de reglas semanales, la lista/calendario de turnos y las acciones de bloqueo en componentes pequeños y reutilizables.
- Definir modelos TypeScript para regla semanal, cancha, turno y estado del turno, además de una función pura para generar turnos a partir de reglas y fechas.
- Encapsular datos de demostración y persistencia local en un servicio frontend. Guardar reglas y bloqueos en `localStorage` para que sobrevivan a recargas en el mismo navegador; validar y versionar el formato para tolerar datos antiguos o corruptos.
- No agregar endpoints, llamadas HTTP, base de datos ni servicios de backend. La persistencia local se identificará como demostración y podrá reemplazarse luego por un adaptador conectado al backend.
- No agregar servicios al Docker Compose existente; la aplicación seguirá siendo el único contenedor del proyecto.

## Criterios de aceptación

- Se puede acceder a la gestión de horarios desde una cancha existente.
- Se pueden habilitar/deshabilitar días y configurar apertura, cierre y duración de turno.
- Se rechazan configuraciones inválidas con explicación accesible y no se pierden valores válidos al corregirlas.
- Al guardar, se ven turnos coherentes durante cuatro semanas según los días activos y duración configurados.
- Se puede bloquear y liberar un turno individual; el cambio se refleja inmediatamente, se conserva al recargar y comunica su resultado.
- La vista es operable con teclado y legible en móvil y escritorio.
- La interfaz y las pruebas no dependen del backend.

## Fuera de alcance

- Reservar turnos para jugadores, cobrar, cancelar reservas existentes o impedir conflictos con datos del servidor.
- Autenticación/autorización real, sincronización multiusuario, disponibilidad concurrente o persistencia remota.
- Cambios en backend, API, base de datos, infraestructura de servidor o contratos de API.
- Cambios en el diseño de Stitch.

## Riesgos y decisiones

- El total real de turnos y bloqueos deberá sincronizarse con el backend cuando exista su contrato. La demo local no representa disponibilidad compartida ni garantiza ausencia de colisiones.
- La ventana inicial es de cuatro semanas, aprobada para esta vista; se mantendrá como una constante/configuración frontend para poder ajustarla.
- La secuencia histórica del plan de implementación no coincide con HU-04 actual. Al implementar se actualizarán solamente los documentos de fase e índices que correspondan a esta HU, sin tratar planes antiguos como criterios vigentes.

## Validación prevista

- Pruebas unitarias de generación de turnos, límites de horario, duración, días deshabilitados y validación de configuración.
- Pruebas de componentes para guardar, bloquear/liberar, estados vacíos y persistencia después de recargar.
- Suite y build de Angular; build/arranque del contenedor frontend existente.
- Revisión visual responsive en escritorio y móvil, flujo manual completo y variante `prefers-reduced-motion`.
- Actualización de checklist frontend de HU-04 en Trello solo después de completar y verificar cada criterio; no modificar el checklist de backend.
