# HU-06 · Reservar turno con grupo completo

## Fases realizadas

1. **Revisión:** se reutilizan complejos, canchas, disponibilidad y `SlotGridService` de HU-05.
2. **Reserva local tipada:** `BookingPreviewStore` registra una reserva completa en memoria, rechaza turnos ya ocupados y conserva los datos del grupo.
3. **Diseño Stitch:** se replicó la pantalla **“Nuevo Partido - Modal de Reserva - PádelMatch La Plata”** como modal global compartido. Tanto **Crear partido** del header como **Crear un nuevo partido** del inicio abren el mismo modal. La ruta anterior `/partidos/crear` se conserva como acceso compatible al modal.
4. **Flujo de jugador:** selector de complejo, cancha, fecha y turno; modalidad; preferencias; alineación de cuatro jugadores; resumen y confirmación local.
5. **Validación:** la grilla pública consulta el mismo store y refleja el turno reservado durante la sesión actual.

## Archivos principales

- `frontend/src/app/create-match/`: modal, selector, preferencias, formulario de alineación y resumen.
- `frontend/src/app/create-match/create-match-modal.store.ts`: apertura y cierre compartidos.
- `frontend/src/app/bookings/booking.model.ts` y `booking-preview.store.ts`: grupo tipado y reservas locales.
- `frontend/src/app/app.html` y `app.ts`: modal montado globalmente para abrirse desde cualquier página.
- `frontend/src/app/landing/landing-header.component.ts` y `landing.page.html`: ambos puntos de entrada.
- Specs en `create-match/`, `bookings/`, `slot-grid/` y `landing/`.

## Validaciones ejecutadas

- `npm run build` desde `frontend/`: correcto.
- `npm test -- --watch=false --include=src/app/create-match/group-details-step.component.spec.ts --include=src/app/landing/landing-header.component.spec.ts --include=src/app/landing/landing.page.spec.ts`: 3 archivos y 12 pruebas correctas.
- Suite completa: 20 archivos correctos; 3 pruebas existentes de HU-04 fallan en `court-availability.page.spec.ts` y `availability-calendar.component.spec.ts` (96/99 correctas). No corresponden al modal ni a los archivos HU-06.
- Contenedor del frontend reconstruido y reiniciado después de los cambios.

## Cómo probarlo manualmente

1. Abrí `http://localhost:8081/` o `http://localhost:8081/partidos`.
2. Desde cualquiera de las dos vistas, presioná **Crear un nuevo partido** o **Crear partido**.
3. Elegí modalidad, complejo, cancha, fecha y turno; seleccioná las preferencias y completá los otros tres jugadores. El responsable es la cuenta activa de demostración.
4. Confirmá la reserva y abrí la grilla del complejo para verla como reservada durante la sesión actual.

## Alcance y límites

- Implementación exclusivamente frontend. No se modificaron backend, API, base de datos ni infraestructura.
- Las reservas viven en memoria de la SPA y se pierden al recargar. Los importes del resumen son de demostración; no se procesan pagos.
- El partido abierto queda registrado localmente como pendiente con tres jugadores faltantes; el partido completo exige cargar a los otros tres jugadores.
- La agenda administrativa con datos de contacto se deja para otra HU, según lo acordado.
- La prevención de conflictos cubre el estado local compartido. La reserva autoritativa entre usuarios requiere integración con backend.

## Ajustes del modal (27/10/2026)

- Se quitaron la línea superior verde y los textos secundarios solicitados; el selector de complejos usa un menú propio coherente con los controles de la aplicación.
- El ícono del calendario se muestra negro y la disponibilidad se presenta en intervalos de una hora (`10:00 a 11:00 hs`).
- Se eliminó el selector de tipo de partido. El responsable y el primer jugador se toman de la cuenta de demo; ya no se solicita volver a ingresar esos datos. Solo se completan los otros tres jugadores.
- Antes de registrar se solicita confirmación con el día y la hora del turno. Al aceptar, el modal se cierra y aparece un toast verde de éxito, sin una pantalla de éxito intermedia. La apertura y el cierre duran un segundo y respetan `prefers-reduced-motion`.
- El resumen, disponibilidad y registro siguen usando datos locales de demostración; no se agregó comunicación con backend.
- Validación de esta corrección: `npm run build` correcto. La compilación conserva dos advertencias de presupuesto de estilos locales en el selector de horarios y el modal.

## Ajustes posteriores (27/10/2026)

- Se compactaron las opciones de convocatoria y se quitaron el acceso al mapa, la etiqueta visible del selector de fecha y el nombre de cancha repetido en cada horario.
- La opción rápida muestra “Hoy” solo cuando está elegida la fecha actual.
- El botón de confirmación ya no queda bloqueado sin explicación: permite enviar para validar y muestra un aviso con desplazamiento al dato faltante. “Partido Abierto” crea una reserva local pendiente de tres jugadores; “Partido Completo” requiere los otros tres nombres.
- Si se elige una fecha distinta de hoy, se oculta el acceso rápido “Hoy”.
