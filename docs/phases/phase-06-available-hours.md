# Fase 06 — Configurar horarios disponibles (HU-04)

## Alcance frontend

- Configurar cada día de la semana y agregar varias franjas no superpuestas (por ejemplo, 09:00–13:00 y 17:00–22:00), con turnos de 60 o 90 minutos.
- Autoguardar configuraciones válidas después de 350 ms sin cambios. Un borrador inválido conserva el último valor guardado y muestra su validación.
- Calcular y mostrar únicamente los turnos de la fecha seleccionada. La navegación anterior se detiene en hoy; la siguiente no tiene límite de semanas.
- Bloquear y liberar una excepción de turno en la vista local.
- Compactar el editor semanal y plegar cada día; agrupar Horarios, Editar y Dar de baja dentro del menú accesible de cada cancha.
- Mantener un lienzo gris perla con tarjetas blancas, vista adaptable, foco visible y soporte de `prefers-reduced-motion`.

## Persistencia local de demostración

- Las reglas recurrentes se guardan en `localStorage` bajo `padelmatch.availability.v2`.
- La primera lectura migra la versión v1 convirtiendo cada horario activo en una franja, conserva identificadores de bloqueos y deja intacta la clave v1 como respaldo.
- Si el navegador no permite escribir, la sesión sigue funcionando en memoria y aparece un aviso.
- Los bloqueos son excepciones locales. La vista calcula horarios a partir de las reglas semanales para la fecha consultada y no materializa filas para todas las fechas futuras.

## Archivos principales

- `frontend/src/app/availability/availability.model.ts` y `availability-generator.ts`: reglas, intervalos, validación y generación pura para una fecha local.
- `frontend/src/app/availability/availability-preview.store.ts`: esquema v2, migración desde v1, persistencia y excepciones de bloqueo.
- `frontend/src/app/availability/weekly-schedule-form.component.*`: acordeón compacto, validación, franjas múltiples y autoguardado.
- `frontend/src/app/availability/availability-calendar.component.*`: turnos y estados accesibles de una fecha.
- `frontend/src/app/availability/court-availability.page.*`: ruta, selección de cancha, navegación diaria y avisos.
- `frontend/src/app/availability/court-picker.component.*`: selector desplegable accesible, opción actual marcada y navegación entre canchas.
- `frontend/src/styles.scss`: tokens de fondo gris perla y cheurón SVG compartido, con soporte de movimiento reducido.
- `frontend/src/app/courts/court-card.component.*`: menú de acciones de la cancha.

## Validaciones

- Suite Angular/Vitest completa previa al refinamiento visual: 55 pruebas en 13 archivos, aprobadas. En esta revisión el runner compila, pero Vitest falla antes de ejecutar pruebas porque no resuelve `@angular/core` desde `init-testbed.js`; queda pendiente repetirlas cuando se corrija la resolución del runner.
- `npm run build`: compilación de producción Angular aprobada.
- `docker compose config --quiet` y `docker compose build frontend`: aprobados; se levantó solo el servicio frontend.
- Prueba manual desktop en `/admin/complejos/complex-gonnet/canchas/court-gonnet-1/horarios`: se configuró lunes 09:00–13:00 y 17:00–22:00, aparecieron nueve turnos y el toast de autoguardado; la configuración sobrevivió una recarga.
- Se avanzó 35 días, se bloquearon y liberaron turnos, y se revisó el menú Horarios/Editar/Dar de baja de la cancha.
- Refinamiento HU-04: se compactó el encabezado, se quitó texto repetido en fecha y horario semanal, se resumieron los días activos y se alinearon las acciones de cada turno. La pantalla equivalente se actualizó en el canvas de Pen, sin reservas manuales ni auditoría fuera del alcance del frontend.
- Refinamiento visual actual: fondo azul oscuro reemplazado por gris perla suave, tarjetas blancas, selector de cancha con menú propio y estado activo, y acciones de cancha con icono moderno de tres puntos. Los cheurones de texto se reemplazaron por SVG.
- La prueba en localhost confirmó navegación diaria, edición plegable y toast de bloqueo/liberación; el turno de prueba se restauró a disponible.
- El diseño actualizado en Pen muestra el lienzo gris perla, tarjetas blancas, selector abierto con cancha activa marcada y controles de icono SVG; la inspección de capas no detectó desbordes.
- `npm run build`: aprobado sin avisos de presupuesto.
- `docker compose build frontend` y `docker compose up -d frontend`: aprobados; el contenedor `frontend` quedó saludable en `localhost:8080`.
- La comprobación visual en el navegador quedó pendiente: la política de navegación bloqueó la URL local de pruebas. El viewport móvil también queda pendiente.

## Límites

Solo frontend y almacenamiento local de demostración. No hay endpoints, backend, base de datos, autorización efectiva ni disponibilidad compartida entre usuarios. La estrategia para el backend será almacenar reglas recurrentes por cancha y persistir reservas/bloqueos excepcionales; consultar turnos calculados para una fecha evita guardar cada turno futuro desocupado.

## Estado

**PARCIAL — HU-04 frontend implementado.** La integración de reservas y bloqueos persistentes requiere backend.
