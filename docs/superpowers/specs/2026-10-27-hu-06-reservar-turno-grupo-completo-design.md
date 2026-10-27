# HU-06: Reservar turno con grupo completo — diseño

## Intención
Permitir que un jugador con sus cuatro integrantes reserve un turno desde el botón **Crear partido** en `/partidos`, con un flujo guiado y una confirmación clara. La reserva será demostrativa y exclusivamente frontend mientras no exista API.

## Objetivos
- Incorporar `/partidos/crear` como flujo por pasos: elegir complejo/día/cancha/horario disponible, cargar responsable y cuatro jugadores, revisar y confirmar.
- Reutilizar el catálogo de complejos, canchas, disponibilidad y la grilla pública HU-05.
- Registrar la reserva en un adaptador/estado local tipado para que aparezca como reservada en las pantallas de turnos mientras viva la sesión de la aplicación.
- Dar estados accesibles de carga, validación, conflicto, confirmación y error; diseño responsive, teclado y foco visibles.
- Mantener componentes pequeños, transiciones breves con `prefers-reduced-motion` y documentar fases, archivos, validaciones y límites.

## Fuera de alcance
Backend, base de datos, endpoints, pagos, autenticación, creación de partidos abiertos, cancelación/edición de reservas y sincronización entre navegadores. La atomicidad frente a dos jugadores en sesiones distintas requiere una operación transaccional del backend; el frontend solo puede detectar conflictos contra el estado local compartido.

## Enfoques considerados
1. **Modal dentro de `/partidos`:** conserva el contexto del listado, pero comprime la selección de turno, el formulario y la revisión; el usuario puede perder el contexto al completar varios datos.
2. **Ruta `/partidos/crear` por pasos (elegida por el usuario):** espacio para seleccionar turno, cargar cuatro jugadores y revisar la reserva; permite enlazar estados y volver atrás sin perder los datos.
3. **Reserva directamente desde cada tarjeta de turno:** reduce pasos, pero no responde al flujo solicitado desde “Crear partido” ni cubre con claridad grupo y resumen.

Se implementará la ruta por pasos. El CTA de “Crear partido” en `/partidos` navegará a ella. La selección consultará complejos/canchas/disponibilidad existente; solo ofrecerá slots disponibles futuros. El resumen previo a confirmar mostrará complejo, cancha, fecha, intervalo horario y los cuatro jugadores. Los datos de contacto del responsable se registran en un campo propio y esa persona puede ser uno de los cuatro jugadores.

## Datos y comportamiento local
- Extender `BookingRecord` con la hora de finalización y los datos de la reserva/grupo que sean necesarios para su visualización; preservar la compatibilidad con reservas determinísticas existentes.
- Añadir a `BookingPreviewStore` una operación tipada para registrar reserva y verificar que el `slotId` no esté ocupado en el estado del store. Las reservas creadas deben tener precedencia sobre fixtures, y el builder de HU-05 debe transformarlas en estado `reserved`.
- El store es singleton en la SPA; los datos creados son efímeros y no representan reservas de backend. Si el slot ya está ocupado localmente, informar el conflicto y permitir elegir otro horario.
- No se promete concurrencia real entre clientes. La integración futura deberá sustituir el adaptador y validar disponibilidad/atomicidad en servidor, y la confirmación del servidor deberá ser autoritativa.

## Integración y arquitectura prevista
- Agregar ruta lazy `/partidos/crear` y una página contenedora enfocada en coordinación de pasos.
- Separar selector de turno, formulario de grupo y resumen/confirmación en componentes reutilizables, alineados al patrón standalone Angular existente.
- Reutilizar `SlotGridService` y `BookingPreviewStore` antes que duplicar reglas de disponibilidad o fixtures.
- Evaluar la agenda del complejo: en el estado actual del repo no hay una agenda admin diaria que use el store de HU-05. No crear una pantalla admin nueva en HU-06: el usuario decidió dejar la visualización en la agenda del complejo para otra HU. Mantener el modelo de reserva con contacto suficiente para facilitar esa integración futura y registrar este criterio pendiente en la documentación.
- Mantener navegación de vuelta a `/partidos` y pasos anteriores preservando selecciones. No alterar otros CTAs de partido abierto.

## Criterios de aceptación
1. “Crear partido” desde `/partidos` abre `/partidos/crear` sin solicitar login.
2. Solo se puede avanzar con una cancha/slot futuro disponible y un grupo completo válido de cuatro jugadores.
3. El paso de revisión muestra complejo, cancha, fecha, horario y grupo; confirmar crea una reserva local y presenta confirmación legible.
4. El slot creado se identifica como reservado al volver a consultar la grilla pública en la misma SPA; un segundo intento local no lo puede volver a reservar.
5. La pantalla comunica validaciones y conflictos sin depender solo del color, funciona con teclado y tiene layout móvil.
6. Build y tests existentes/nuevos pasan; no se modifican backend, infraestructura ni Docker.

## Riesgos y llamadas de implementación
- La grilla pública existente depende de URL de complejo y fecha; el selector deberá coordinar esos parámetros sin duplicar el servicio.
- Los horarios se generan como slots de disponibilidad y la reserva tiene un intervalo; al implementar se debe confirmar el esquema horario existente y conservar el identificador del slot como clave de exclusión.
- La historia menciona que la reserva aparece en la agenda del complejo. En el repo actual no hay una agenda diaria compartida; este alcance prepara el dato local y lo muestra como reservado en la grilla pública HU-05. La visualización administrativa con contacto se difiere a otra HU por decisión del usuario.
- El estado local no persiste al cerrar o recargar la aplicación ni coordina sesiones distintas.

## Validación
Pruebas unitarias del store (creación, colisión local, precedencia), componentes/página (validación, navegación entre pasos, confirmación, error de conflicto) y grilla (reserva visible); ejecutar pruebas y build disponibles. Verificar manualmente en viewport escritorio y móvil.



## Ajuste de interacción aprobado (2026-10-27)

El usuario cambió el punto de entrada visual: la pantalla Stitch **“Nuevo Partido - Modal de Reserva - PádelMatch La Plata”** es la referencia implementable. El modal se monta una sola vez en `app.html` y se abre desde **Crear partido** del header o **Crear un nuevo partido** del inicio. La ruta `/partidos/crear` sigue siendo compatible y también abre ese modal. Se reutilizan selector de disponibilidad HU-05, formulario de grupo y resumen; se conservan la reserva local y sus límites.

La decisión no incorpora backend, pagos ni persistencia remota. La modalidad abierta permanece visible como opción de diseño, pero informa que requiere una fase posterior; solo se puede confirmar el partido completo con cuatro jugadores.
