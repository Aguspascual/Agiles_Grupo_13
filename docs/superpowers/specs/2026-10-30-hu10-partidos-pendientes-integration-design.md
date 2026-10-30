# Diseño de integración HU-10: partidos pendientes

## Objetivo

Conectar la búsqueda pública de `/partidos` con datos persistidos en backend y completar el flujo mínimo de creación y unión de HU-06/HU-11 para que los partidos pendientes se puedan generar y consultar de punta a punta.

## Estado actual

- `MatchSearchPage` filtra `MATCHES`, un arreglo estático de `landing.data.ts`; el detalle y la acción de unirse son demostraciones locales.
- El botón “Crear partido” de la cabecera lleva a `/partidos`; esta rama base no contiene un formulario de creación.
- El backend crea reservas web solo para un grupo completo. La tabla `reservations` controla ocupación y conflictos, pero no guarda nivel buscado ni jugadores.
- El endpoint público de disponibilidad devuelve franjas y estados de reserva, y deliberadamente no revela datos de los jugadores.
- El endpoint de reserva de HU-06 ya admite grupos completos con contacto; el alta abierta y la unión de HU-11 no tienen API.

## Enfoques considerados

1. **Partido vinculado a una reserva (elegido):** agregar un recurso persistido de partido y participantes, enlazado uno a uno a la reserva que bloquea cancha/horario. Conserva la lógica de disponibilidad y permite mostrar datos reales del grupo.
2. **Extender directamente `reservations`:** agrega tipo de partido, nivel y participantes a la entidad actual. Reduce una relación, pero mezcla el ciclo de vida de una reserva con la convocatoria y cambia supuestos de HU-06.
3. **Mantener datos locales:** no resuelve la integración solicitada ni permite que otros usuarios vean un partido creado.

Se elige el primer enfoque para mantener responsabilidades claras y reutilizar la reserva como fuente de ocupación.

## Diseño propuesto

### Persistencia y reglas

- Crear una tabla `pending_matches` con referencia única a `reservations`, nivel buscado y estado (`open`/`full`).
- Crear una tabla de participantes ligada al partido y al usuario; el organizador ocupa el primer lugar.
- Persistir un aviso por jugador cuando se ocupa el cuarto lugar y permitir marcarlo como leído.
- Al crear, validar perfil autenticado, cancha y horario configurado, fecha futura y ausencia de solapamientos. Crear reserva, partido y participante organizador en una transacción.
- Al unirse, bloquear/actualizar el partido de forma atómica: rechazar duplicados y partidos completos, insertar al jugador y pasar a `full` al alcanzar cuatro participantes. Una carrera por el último cupo debe producir un único ganador.
- Conservar historial de reservas y participantes; cancelar, abandonar o reemplazar partidos queda fuera de este alcance.

### API propuesta para revisión

Los nombres y payloads son una propuesta de diseño; se ajustarán a las convenciones del backend antes de implementarlos.

- `GET /api/v1/matches`: consulta pública de partidos pendientes, con filtros de fecha y complejo. Responde solo partidos abiertos con cupos, horarios, club/cancha, nivel buscado, precio y participantes visibles.
- `GET /api/v1/public/complexes`: catálogo público mínimo de complejos y canchas activas, sin teléfono ni datos de gestión; habilita el formulario de reserva para jugadores.
- `POST /api/v1/complexes/{complexId}/courts/{courtId}/matches`: requiere JWT; crea la reserva y la convocatoria abierta a partir de fecha, hora de inicio y nivel buscado. El usuario autenticado es el organizador.
- `POST /api/v1/matches/{matchId}/players`: requiere JWT; suma al usuario autenticado. Devuelve el partido actualizado; conflictos por duplicado/cupo completo se expresan como `409`.
- `GET /api/v1/match-notices` y `POST /api/v1/match-notices/{noticeId}/read`: consulta avisos propios no leídos y confirma su lectura.
- Los participantes expuestos públicamente incluyen solo nombre visible, nivel y posición. No se envían email, teléfono ni otros datos de contacto.
- La compatibilidad de nivel informa una advertencia visual según la diferencia con el nivel buscado; no bloquea la unión.
- Al completarse el grupo, generar avisos para los cuatro participantes con el mecanismo de notificaciones existente o una extensión compatible.

### Frontend

- Reemplazar fixtures en la búsqueda por un servicio Angular tipado que cargue `/api/v1/matches`, traduzca el DTO al modelo de tarjeta/detalle y mantenga filtros y presentación actuales.
- Conservar el acceso público a `/partidos`; mostrar estados de carga, error, vacío y reintento.
- Conectar el modal de detalle a los datos recibidos. La acción de unión requiere sesión; si no hay sesión, dirigir a ingreso conservando el destino. Si hay sesión, usar el endpoint de unión y actualizar el partido mostrado/listado, con feedback de éxito o conflicto.
- Conectar “Crear partido” a un formulario/modal basado en “Nuevo Partido - Modal de Reserva - PádelMatch La Plata”, con partido completo y abierto. HU-06 reutiliza el endpoint actual; el abierto usa la nueva API. Complejos, canchas y disponibilidad son reales. El nombre del responsable viene de la sesión y se pide teléfono porque todavía no forma parte del perfil de backend.
- Mostrar los avisos no leídos de HU-11 en el menú de notificaciones, también accesible en el menú móvil.
- Mantener componentes enfocados y reutilizar los clientes HTTP, guards, tokens, modelos y estilos existentes.

## Alcance

Incluye HU-10 (búsqueda y detalle con datos reales), alta de grupo completo HU-06 usando la API existente, alta abierta necesaria para poblar resultados y unión HU-11 para completar cupos. Incluye persistencia, migración y APIs necesarias.

No incluye pagos, cancelación/abandono de partidos, reemplazo del grupo (HU-12), lógica de agenda administrativa, cambios de Docker/infraestructura ni información privada de contacto en el listado público.

## Validaciones y documentación

- Validar filtros y estados de la consulta, datos de roster, autenticación de escritura, conflictos de horario, duplicados, capacidad y carrera por el último cupo.
- Ejecutar verificaciones disponibles de backend y frontend una vez implementado; reconstruir/reiniciar todos los contenedores del proyecto para permitir la prueba manual.
- Documentar fases, archivos principales, validaciones y límites en un Markdown de HU-10.
- Dejar la rama sin commit, push, merge o PR hasta que el usuario revise el resultado.

## Riesgos a resolver durante el plan

- El formulario HU-06 no está presente en la base `Desarrollo`; habrá que recuperar su presentación de Stitch y adaptar sus opciones al endpoint real de disponibilidad.
- El endpoint de disponibilidad puede no exponer intervalos adecuados para crear partidos abiertos; se debe reutilizar su contrato o extenderlo solo si una comprobación demuestra que hace falta.
- El detalle público de nombres/niveles debe mantenerse acotado a los campos indicados y no revelar datos de contacto.
