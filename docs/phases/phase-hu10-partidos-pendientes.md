# HU-10 · Partidos pendientes e integración

## Fases realizadas

1. **Persistencia:** migración `008_pending_matches.sql` agrega convocatorias enlazadas uno a uno con reservas, participantes y avisos de grupo completo. La reserva sigue siendo la fuente de ocupación.
2. **API:** consulta pública de convocatorias abiertas; catálogo público de complejos/canchas sin datos de contacto; creación autenticada de convocatorias; unión autenticada con control transaccional de cupos; avisos privados de HU-11.
3. **Frontend:** `/partidos` consulta API real y conserva filtros, detalle y estados de carga/error/vacío. Crear partido permite convocatoria abierta y grupo completo; ambas opciones consultan complejos y disponibilidad actuales.
4. **Sesión y notificaciones:** una acción protegida conserva su destino durante el ingreso. El menú de notificaciones permite consultar y marcar como leído el aviso generado al completar el grupo.
5. **Búsqueda simplificada:** se retiró la tarjeta de búsqueda/orden/vista. Cuando no hay convocatorias en la API se informa que todavía no se publicaron partidos y se ofrece el acceso a crear uno; si los filtros no encuentran resultados, se conserva un mensaje específico para ese caso.

## Archivos principales

- Backend: `backend/internal/matches/{model.go,postgres.go,service.go}`, `backend/cmd/api/routes.go`, `backend/migrations/008_pending_matches.sql`.
- Frontend: `frontend/src/app/matches/`, `frontend/src/app/bookings/reservation-api.service.ts`, `frontend/src/app/landing/`, `frontend/src/app/auth/{auth.guard.ts,login.page.ts}`.
- Contratos: `docs/phases/hu10-api-partidos-pendientes.md`.

## Contratos implementados

- `GET /api/v1/matches?date=&complexId=&level=`: convocatorias abiertas futuras; respuesta pública limitada a nombres visibles, nivel y posición.
- `GET /api/v1/public/complexes`: complejos y canchas activos para el formulario, sin teléfonos ni datos administrativos.
- `POST /api/v1/complexes/{complexId}/courts/{courtId}/matches`: convocatoria abierta, requiere JWT y crea reserva + partido + organizador en una transacción.
- `POST /api/v1/matches/{matchId}/players`: unión autenticada; responde conflicto si el partido está completo o el jugador ya participa.
- `GET /api/v1/match-notices` y `POST /api/v1/match-notices/{noticeId}/read`: avisos propios de grupo completo.
- Partido completo reutiliza `POST /api/v1/complexes/{complexId}/courts/{courtId}/reservations` de HU-06.

## Límites y datos faltantes

- El perfil actual no incluye teléfono. Para reservar un grupo completo se solicita el contacto en el formulario; no se guarda ni expone en el listado.
- El backend actual no ofrece precio de cancha; la búsqueda no muestra importes de fixture como si fueran reales.
- La imagen de cancha usa un recurso visual local porque el contrato de API no guarda fotos de complejos/canchas.
- Cancelación, abandono, reemplazo de jugadores, pagos y agenda administrativa siguen fuera del alcance de esta HU.

## Validaciones realizadas

- `npx tsc --noEmit -p tsconfig.app.json`: correcto.
- `npx ngc --noEmit -p tsconfig.app.json`: correcto, validando también las plantillas Angular.
- `docker compose up -d --build --force-recreate`: build Go y Angular correctos. Angular reportó advertencias de presupuesto en el bundle inicial (510.97 kB frente a 500 kB) y hojas SCSS de cabecera/modal.
- Salud HTTP verificada: frontend `200`, API `/health` `204`, consulta de partidos `200`, catálogo público `200`. Backend y base de datos están healthy.
- El recorrido autenticado de creación/unión con dos cuentas queda como prueba manual pendiente; no se ejecutaron suites automatizadas.

## Prueba manual al levantar Compose

1. Iniciar sesión con un usuario jugador que tenga perfil.
2. Abrir `/partidos`, consultar partidos abiertos y abrir el detalle.
3. Crear un partido abierto y revisar que aparezca en la búsqueda.
4. Ingresar con otra cuenta de jugador y unirse; repetir hasta completar cuatro plazas.
5. Abrir notificaciones con los usuarios del partido y marcar el aviso como leído.
6. Crear un partido completo; elegir complejo, cancha, horario libre y completar el teléfono de contacto solicitado.

Los cambios de código siguen sin commit, push, merge ni PR.
