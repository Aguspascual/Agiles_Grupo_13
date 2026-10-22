# HU-04: configurar horarios disponibles — Plan de implementación

> **Para agentes de implementación:** usar `superpowers:executing-plans` para avanzar tarea por tarea. Marcar cada paso al completarlo.

**Objetivo:** habilitar en el frontend la configuración semanal de horarios por cancha, la visualización de turnos durante cuatro semanas y el bloqueo/liberación puntual, con datos locales de demostración.

**Arquitectura:** agregar un dominio pequeño de disponibilidad debajo de `frontend/src/app/availability`. Una función pura generará los turnos; un servicio frontend persistirá reglas y bloqueos versionados en `localStorage`; una página dedicada integrará el editor semanal, la agenda y el acceso desde las tarjetas de cancha.

**Tecnologías:** Angular standalone 21, TypeScript, Reactive Forms, signals, Vitest, SCSS y Docker Compose frontend existente.

**Especificación:** [2026-10-12-hu-04-horarios-disponibles-design.md](../specs/2026-10-12-hu-04-horarios-disponibles-design.md)

## Restricciones globales

- Implementar únicamente frontend; no crear ni modificar backend, endpoints, base de datos ni infraestructura de servidor.
- Mantener componentes pequeños, reutilizables y sencillos de revisar.
- Guardar la demo solo en `localStorage`, versionando y validando los datos leídos.
- Generar una ventana inicial de cuatro semanas y turnos de 60 o 90 minutos.
- Respetar accesibilidad, teclado, foco visible y `prefers-reduced-motion`.
- Mantener Docker Compose como contenedor de frontend solamente.
- Documentar fases, archivos, validación y límites en Markdown.
- No marcar trabajo de backend como completado en Trello.

## Foco de revisión

1. Apertura/cierre inválidos, duración no admitida o ventana demasiado corta: el formulario los rechaza con errores asociados a los campos y conserva lo ingresado. Prueba en `weekly-schedule-form.component.spec.ts`.
2. Turnos de 60/90 minutos que no dividen exactamente el horario, días deshabilitados y cruce de fin de mes/año: solo se generan intervalos completos en fechas correctas. Pruebas en `availability-generator.spec.ts`.
3. Datos ausentes, corruptos o de una versión futura en `localStorage`: cargar valores demo válidos sin bloquear la página. Prueba en `availability-preview.store.spec.ts`.
4. Bloquear y liberar un turno: el estado se refleja al instante y sobrevive a una recarga. Pruebas en el store y `availability-calendar.component.spec.ts`.
5. Cancha o complejo inexistente y viewport móvil: mostrar navegación/estado vacío comprensible sin excepción ni desbordamiento horizontal. Prueba de ruta en `court-availability.page.spec.ts` y validación visual manual responsive.

---

## Estructura prevista

- `frontend/src/app/availability/availability.model.ts`: tipos de reglas semanales, turnos e identificadores de estado.
- `frontend/src/app/availability/availability-generator.ts`: generación y validación pura de turnos para fechas locales.
- `frontend/src/app/availability/availability-preview.store.ts`: reglas demo, persistencia local versionada y comandos para guardar/bloquear/liberar.
- `frontend/src/app/availability/weekly-schedule-form.component.*`: editor accesible de los siete días, apertura/cierre y duración.
- `frontend/src/app/availability/availability-calendar.component.*`: agenda responsive agrupada por fecha y acciones de bloqueo.
- `frontend/src/app/availability/court-availability.page.*`: integración de ruta, cancha, configuración, agenda y toast.
- `frontend/src/app/courts/court-card.component.*`: enlace a horarios de la cancha.
- `frontend/src/app/app.routes.ts`: ruta dedicada `/admin/complejos/:complexId/canchas/:courtId/horarios`.
- `docs/IMPLEMENTATION-PLAN.md`, `docs/phases/README.md` y fase 06: reemplazar la descripción obsoleta de publicación de partido para reflejar HU-04 vigente; registrar alcance y límites frontend.

## Tareas

### Tarea 1: modelos y generador de turnos

**Archivos:** crear `availability.model.ts`, `availability-generator.ts` y `availability-generator.spec.ts`.

**Interfaces:**

- `Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7` (lunes a domingo).
- `WeeklyScheduleRule`: `weekday`, `enabled`, `opensAt`, `closesAt`, `durationMinutes: 60 | 90`.
- `AvailabilitySlot`: `id`, `courtId`, `date` (`YYYY-MM-DD` local), `startsAt`, `endsAt`, `status: 'available' | 'blocked'`.
- `generateAvailabilitySlots(courtId: string, rules: WeeklyScheduleRule[], from: Date, numberOfDays: number, blockedSlotIds?: ReadonlySet<string>): AvailabilitySlot[]`.

- [x] **Paso 1: escribir pruebas que fallen** para días deshabilitados, generación de intervalos completos de 60 y 90 minutos, cierre sin intervalo parcial, ids estables y fechas locales al cruzar un mes/año.
- [x] **Paso 2: ejecutar `cd frontend; npm test -- --watch=false`**; verificar que el nuevo test falla por el módulo inexistente.
- [x] **Paso 3: implementar los modelos y la función pura**; recorrer días de calendario local, alinear el primer turno a apertura, excluir turnos que excedan el cierre y aplicar ids bloqueados.
- [x] **Paso 4: volver a ejecutar `cd frontend; npm test -- --watch=false`**; esperar todos los casos PASS.

### Tarea 2: almacenamiento demo versionado

**Archivos:** crear `availability-preview.store.ts` y `availability-preview.store.spec.ts`.

**Interfaces:** `AvailabilityPreviewStore.rulesFor(courtId): WeeklyScheduleRule[]`, `saveRules(courtId, rules): void`, `slotsFor(courtId, from, numberOfDays): AvailabilitySlot[]`, `toggleBlocked(slotId): void`. Usar clave única `padelmatch.availability.v1`; las reglas demo iniciales tienen siete días cerrados, horario editable 09:00–22:00 y duración 60 minutos.

- [x] **Paso 1: escribir pruebas que fallen** para estado inicial, escritura/lectura, bloqueo/liberación y contenido corrupto o versión desconocida en `localStorage`.
- [x] **Paso 2: correr `cd frontend; npm test -- --watch=false`** y confirmar fallo antes de implementar.
- [x] **Paso 3: implementar el store con signals**, validación del formato cargado y fallback seguro al estado demo; no acceder a `window` si no está disponible.
- [x] **Paso 4: correr `cd frontend; npm test -- --watch=false`** y verificar que cambios y bloqueos sobrevivan a recrear el store.

### Tarea 3: editor semanal reusable

**Archivos:** crear `weekly-schedule-form.component.ts`, `.html`, `.scss` y `.spec.ts`.

**Interfaces:** entrada `rules: WeeklyScheduleRule[]`; salidas `save: WeeklyScheduleRule[]` y `cancel: void`. Usar Reactive Forms y etiquetas asociadas a cada control.

- [x] **Paso 1: escribir pruebas que fallen** para habilitar/deshabilitar días, emitir horario válido, rechazar cierre anterior/igual a apertura, duración inválida e intervalo menor a la duración seleccionada.
- [x] **Paso 2: correr `cd frontend; npm test -- --watch=false`** y verificar fallo inicial.
- [x] **Paso 3: implementar el formulario** con duración de 60/90, mensajes junto a los campos, estados disabled claros y layout compacto que se adapte a móvil.
- [x] **Paso 4: correr `cd frontend; npm test -- --watch=false`**; comprobar navegación por teclado, `aria-describedby` de errores y `aria-invalid` cuando corresponda.

### Tarea 4: agenda y estados de turnos

**Archivos:** crear `availability-calendar.component.ts`, `.html`, `.scss` y `.spec.ts`.

**Interfaces:** entrada `slots: AvailabilitySlot[]`; salida `toggleBlocked: string` con el id del turno accionado.

- [x] **Paso 1: escribir pruebas que fallen** para turnos agrupados por fecha, estado disponible/bloqueado y acciones con nombres accesibles de bloquear/liberar.
- [x] **Paso 2: correr `cd frontend; npm test -- --watch=false`** y verificar fallo inicial.
- [x] **Paso 3: implementar la agenda** con fecha/hora y estado textual, acción de bloqueo reversible y layout de una columna en móvil; no usar color como única señal.
- [x] **Paso 4: ejecutar `cd frontend; npm test -- --watch=false`** y revisar que las transiciones sean breves y se apaguen con `prefers-reduced-motion`.

### Tarea 5: página, navegación y conexión local

**Archivos:** crear `court-availability.page.ts`, `.html`, `.scss` y `.spec.ts`; modificar `app.routes.ts` y `court-card.component.ts`, `.html`, `.scss`.

**Interfaces:** la ruta recibe `complexId` y `courtId`; la página resuelve ambos desde `ComplexPreviewStore` y `CourtPreviewStore`, carga reglas/agenda del `AvailabilityPreviewStore` e integra el editor y calendario. La tarjeta incorpora enlace etiquetado a “Configurar horarios”.

- [x] **Paso 1: escribir pruebas que fallen** para enlace desde tarjeta, ruta válida, cancha inexistente, guardar reglas, generación a 28 días y bloqueo/liberación con toast.
- [x] **Paso 2: correr `cd frontend; npm test -- --watch=false`** y confirmar fallos iniciales.
- [x] **Paso 3: implementar ruta y página**, enlazando outputs a store; recargar la agenda luego de guardar o cambiar el estado de un turno.
- [x] **Paso 4: ejecutar `cd frontend; npm test -- --watch=false`** y verificar que no se agreguen peticiones HTTP ni nuevas dependencias.
- [x] **Paso 5: validar manualmente** flujo completo en navegador a 1440px y 375px, comparando configuración y agenda con las dos pantallas de Stitch; revisar recarga y ausencia de desbordamiento horizontal. Teclado, accesibilidad y `prefers-reduced-motion` están cubiertos por pruebas y estilos.

### Tarea 6: documentación, verificaciones y Trello

**Archivos:** actualizar `docs/IMPLEMENTATION-PLAN.md`, `docs/phases/README.md`; retirar `docs/phases/phase-06-create-match.md` obsoleto y crear `docs/phases/phase-06-available-hours.md` con objetivo, archivos, validaciones, límites frontend y estado respaldado por resultados.

- [x] **Paso 1: actualizar documentos de fase** para identificar HU-04 como configuración de horarios disponibles; no mantener endpoint de publicación como alcance de esta HU.
- [x] **Paso 2: ejecutar suite y build** con `cd frontend; npm test -- --watch=false` y `cd frontend; npm run build`; resolver cualquier fallo relacionado.
- [x] **Paso 3: verificar Docker frontend** con `docker compose config` y `docker compose build frontend`; no iniciar ni agregar backend.
- [x] **Paso 4: revisar `git diff --check`, estado Git y diff**; comprobar que cambios pertenecen a HU-04, documentación coherente y hojas de estilos/componentes de tamaño razonable.
- [x] **Paso 5: actualizar en Trello solo los tres ítems del checklist Frontend de HU-04** cuando su evidencia esté completa; dejar intacto el checklist Backend.
- [x] **Paso 6: proponer el mensaje de commit en español:** `HU-04: configurar horarios disponibles por cancha en el frontend`.

## Revisión del plan

- La configuración semanal, validación, duración, generación por 28 días, bloqueo reversible, datos demo, persistencia, accesibilidad, responsive, Docker frontend, documentación y actualización frontend de Trello están asignados a tareas explícitas.
- La generación de intervalos completos usa fechas/calendario locales y claves estables; el formato persistido está versionado y tiene fallback seguro.
- Los componentes intercambian tipos definidos en la primera tarea y mantienen la escritura local centralizada en el store.
- No se agregan servicios de backend, endpoints, base de datos ni dependencias.
