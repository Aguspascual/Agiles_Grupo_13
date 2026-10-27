# Fase 07 — Grilla de turnos del complejo (HU-05)

## Alcance frontend

- Ruta pública `/clubes/:complexId/turnos`, visible sin sesión. El botón "Explorar turnos" del directorio de clubes abre la grilla de cada club.
- Grilla de canchas por horario para el día elegido: una columna por cancha y filas de 30 minutos. Los turnos de 60 y 90 minutos ocupan el alto que les corresponde, aunque las canchas tengan horarios distintos.
- Cuatro estados diferenciados por color, ícono y texto: Libre, Partido abierto (con cuántos jugadores faltan y el nivel buscado), Reservado y Clase. Un turno que el complejo cerró desde HU-04 se ve como "No disponible", con el mismo estilo que uno reservado. La leyenda explica los cuatro estados.
- Navegación por día con flechas y accesos directos a los próximos 14 días. No se puede volver antes de hoy. La fecha queda en la URL (`?fecha=AAAA-MM-DD`), así que se puede recargar o compartir.
- Los turnos que ya empezaron se ven en gris, solo con el horario, y no se pueden elegir. En el día de hoy la grilla se ubica en la hora actual; en otros días, en el primer turno libre.
- Al elegir un turno libre o un partido abierto aparece un resumen con cancha, día y horario. Sin sesión invita a ingresar. La reserva queda para HU-06 y sumarse a un partido para HU-11.
- En celulares la grilla se desplaza en horizontal con la columna de horas y los nombres de cancha fijos.

## Datos de demostración

- Usa los horarios guardados en HU-04 (`localStorage`, clave `padelmatch.availability.v2`) y respeta sus bloqueos.
- Si una cancha todavía no tiene horarios guardados, usa un horario de ejemplo: lunes a viernes de 08:00 a 23:00 y fines de semana de 09:00 a 21:00, con turnos de 90 minutos (60 en la Cancha 2 de Gonnet y de City Bell).
- Las reservas, partidos abiertos y clases de ejemplo se calculan por turno de forma determinística (`BookingPreviewStore`): el mismo turno muestra siempre el mismo estado, con más reservas desde las 18:00 y más clases durante el día.
- Los tres clubes del directorio público (La Cumbre Pádel, City Bell Padel Hub y Estudiantes de La Plata) se sumaron como complejos de demo, con sus canchas, para que cada tarjeta abra su propia grilla.

## Archivos principales

- `frontend/src/app/slot-grid/complex-slots.page.*`: ruta, fecha en la URL, estados de carga, club inexistente y club sin canchas.
- `frontend/src/app/slot-grid/slot-grid.component.*`: grilla reutilizable (HU-07 puede pasar su propio contenido de celda con `cellTemplate`).
- `frontend/src/app/slot-grid/slot-grid.builder.ts`: combinación pura de horarios, bloqueos y reservas; cálculo de filas.
- `frontend/src/app/slot-grid/slot-grid.service.ts`: fuente de datos; único punto a cambiar al integrar la API.
- `frontend/src/app/slot-grid/day-strip.component.*`, `slot-legend.component.ts`, `slot-summary.component.*`: selector de día, leyenda y resumen.
- `frontend/src/app/bookings/`: modelo de reserva y reservas de demostración.
- `frontend/src/styles/_slot-states.scss`: colores de estado compartidos con la agenda del complejo.
- `docs/contracts/hu-05-grilla-de-turnos.md`: contrato propuesto para backend.

## Validaciones

- `npm run build`: aprobado sin advertencias; el bundle inicial quedó en 391 kB al cargar bajo demanda las pantallas de administración.
- `npm test -- --watch=false`: 85 pruebas aprobadas, 24 de ellas nuevas de HU-05. Siguen fallando 3 pruebas de HU-04 que ya fallaban antes de este cambio (ver changelog).
- Recorrido en Chromium a 1280 × 860 y 390 × 844: directorio → Explorar turnos → día siguiente → elegir partido abierto → resumen → cerrar con Escape, sin errores de consola.

## Límites

Solo frontend con datos de demostración. No hay reservas reales ni datos compartidos entre usuarios. Falta el endpoint `GET /api/v1/complexes/{complexId}/slots`.

## Estado

**PARCIAL — HU-05 frontend implementado.** Falta backend e integración.
