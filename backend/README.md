# Backend HU-01 a HU-04

API Go para registro e inicio de sesión, con PostgreSQL como almacenamiento.

## Trabajo en equipo

- Elegir una HU en Trello, registrarse en la tarjeta y avisar por el grupo.
- Crear la rama desde `Desarrollo` actualizado: `feature/descripcion`, por ejemplo `feature/horarios-disponibles`.
- Usar commits atómicos `HU-XX: verbo en infinitivo + qué se hizo`; no subir `node_modules` ni archivos `.env`.
- Abrir PR a `Desarrollo` con título `HU-XX (back): nombre de la historia`, link a Trello, qué cambia y cómo probarlo. Requiere una aprobación de otro integrante backend.
- Con aprobación y validaciones correctas, el reviewer asignado integra con **Create a merge commit**. El autor no integra su propia PR. Después, eliminar la rama cuando no queden dependientes y pegar el link de la PR en Trello.

Los [acuerdos backend](../docs/backend/AGENTS_BACK.md) reúnen el detalle de este flujo y la práctica TDD. No implementar sin aprobación del TDD correspondiente.

## Configuración

Definir `DATABASE_URL`, `JWT_SECRET` (secreto de al menos 32 bytes) y, opcionalmente, `PORT` (por defecto `8000`). Al iniciar, el servidor comprueba PostgreSQL y aplica la migración incluida.

```powershell
cd backend
go run ./cmd/api
```

## API

- `POST /api/v1/auth/register`: recibe `name`, `email`, `password`, `zone`, `level`, `position`, `hand` y `fairPlay`; devuelve usuario y JWT.
- `POST /api/v1/auth/login`: recibe `email` y `password`; devuelve usuario y JWT.
- `GET /api/v1/auth/me`: requiere `Authorization: Bearer <token>` y devuelve el usuario de la sesión.
- `PUT /api/v1/auth/me`: requiere JWT y los cinco campos `name`, `zone`, `level`, `position` y `hand`; devuelve el usuario actualizado. Posición y mano aceptan cadena vacía para limpiar el valor. No modifica credenciales ni roles.
- `GET /health`: responde `204` cuando el proceso está activo.

`zone` acepta únicamente Casco Urbano, Gonnet, City Bell, San Carlos, Tolosa, Villa Elisa o Berisso / Ensenada. Se recortan espacios al inicio y final. El registro crea `users` y `player_profiles` en una misma transacción. La migración no crea tablas `zones` ni `user_zones`.

## HU-02 — Complejos

- `GET /api/v1/public/complexes`: público (sin JWT, sin query); devuelve `{"complexes":[{id,name,address,zone}]}` de complejos activos ordenados por `name, id`, con `Cache-Control: no-store` (TDD-0014).
- `GET /api/v1/complexes`: requiere JWT; ADMIN ve todos los activos y los encargados solo los asignados.
- `POST /api/v1/complexes`: requiere ADMIN; recibe `name`, `address`, `zone`, `phone` y `managerIds`.
- `PUT /api/v1/complexes/{id}`: ADMIN puede cambiar datos y encargados; un encargado asignado puede cambiar datos conservando la misma lista de encargados.
- `DELETE /api/v1/complexes/{id}`: requiere ADMIN y realiza una baja lógica.
- `GET /api/v1/complexes/available-managers`: requiere ADMIN; devuelve usuarios registrados con perfil (`id`, `name`, `email`).

La migración `002_complexes.sql` agrega `users.role`, con valores `USER` o `ADMIN` y valor predeterminado `USER`. El registro público no recibe ni asigna roles: toda alta comienza como `USER`. Para promover manualmente una cuenta de desarrollo, ejecutar SQL con acceso administrativo a PostgreSQL, identificando la cuenta por email:

```sql
UPDATE users SET role = 'ADMIN', updated_at = now() WHERE email = 'admin@example.com';
```

Los complejos se eliminan de forma lógica (`deleted_at`), se excluyen de listados y conservan sus asignaciones. No se crean todavía canchas, horarios ni reservas.

## HU-03 — Canchas

- `GET /api/v1/complexes/{complexId}/courts`: ADMIN o encargado asignado al complejo activo.
- `POST /api/v1/complexes/{complexId}/courts`: crea una cancha en el complejo autorizado; recibe `name`, `covered`, `features` e `imageDataUrl` opcional.
- `PUT /api/v1/complexes/{complexId}/courts/{courtId}`: actualiza esos mismos campos.
- `DELETE /api/v1/complexes/{complexId}/courts/{courtId}`: la baja lógica se rechaza con `503` hasta integrar una fuente real de reservas.

Las características admitidas son `lighting`, `electronicScoreboard`, `wifi` y `acrylicSurface`. PostgreSQL las guarda en cuatro columnas booleanas. La imagen opcional llega como Data URL JSON, se valida como PNG, JPEG o WebP real y hasta 5 MiB; la base guarda los bytes en `BYTEA` y su tipo MIME.

La migración `003_courts.sql` crea canchas con FK restrictiva a `complexes`, baja lógica e índice de canchas activas por complejo. No agrega datos ficticios de reservas ni una columna `hasFutureReservations`. Mientras no exista una fuente de reservas PostgreSQL, no se puede determinar si una cancha tiene turnos futuros y la API falla de forma segura al intentar darla de baja. La baja efectiva y el tercer criterio de Trello quedan pendientes de integrar la consulta de reservas y coordinarla transaccionalmente con la operación que las cree.

## HU-04 — Horarios recurrentes

La configuración diaria se persiste mediante `004_weekly_schedules.sql`.
Consultar los [TDD de backend](../docs/backend/TDDs/README.md) para los contratos de HU-04.
El alta, la consulta y los cambios de habilitación/duración están implementados.
La baja y el reemplazo de franjas responden `503` mientras no esté integrada la
fuente real de reservas. HU-04 completa, generación y bloqueos puntuales siguen pendientes.

## HU-08 — Modificación del perfil propio

`PUT /api/v1/auth/me` actualiza únicamente el perfil del titular del JWT. Acepta los
valores de perfil ya admitidos por el registro, exige los cinco campos y rechaza
campos extra, ausentes, nulos o JSON adicional. La integración con Angular y la
presentación del perfil en partidos quedan pendientes; no se incluyen múltiples
zonas ni privacidad.

## HU-15 — Alta de reservas manuales

`POST /api/v1/complexes/{complexId}/courts/{courtId}/manual-reservations` requiere
JWT y permiso de administrador general o encargado asignado al complejo. Recibe
`date`, `startsAt` y `contact: { name, phone }`; devuelve `201` con la misma forma de
reserva de HU-06. El servidor define duración, estado y registrante. Se rechazan con
`400` los datos inválidos, con `401/403` la falta de autenticación/permiso, con `404`
los recursos inexistentes y con `409` los turnos pasados, fuera de configuración u ocupados.

La migración `007_manual_reservations.sql` conserva los registros web y agrega origen
y registrante. Las reservas manuales no tienen organizador ni acompañantes ficticios,
no aparecen como reservas personales del empleado y no generan avisos. Comparten
ocupación, bloqueos, disponibilidad HU-05 y protecciones HU-03/04 con las reservas web.
El número `006` queda para HU-14; no es necesario que exista para aplicar `007`.

**Despliegue coordinado:** detener los escritores antiguos, aplicar la migración y
arrancar el backend actualizado. La escritura web anterior no completa la nueva
columna obligatoria `registered_by`. No ejecutar una reversión destructiva con reservas
manuales guardadas. No se cambia ni habilita la cancelación HU-14 para reservas manuales.

Diseño: [TDD-0012](../docs/backend/TDDs/TDD-0012-hu-15-alta-reserva-manual.md).
Fases y validaciones: [implementación HU-15](../docs/backend/HU-15-implementacion.md).
Frontend, agenda, edición, cancelación, participantes, pagos y notificaciones externas
siguen fuera del alcance de esta entrega.

## HU-14 y HU-07 - Cancelación de reservas

- `POST /api/v1/reservations/{reservationId}/cancel`: el jugador organizador cancela su
  reserva web hasta 4 h antes del inicio (límite inclusivo, RN-02). Las manuales responden 404.
- `POST /api/v1/complexes/{complexId}/reservations/{reservationId}/cancel`: el encargado
  asignado o el administrador general cancela una reserva web o manual que aún no terminó,
  sin límite de 4 h. Si ya terminó responde 409.
- Ambas: Bearer, sin body ni query, `Cache-Control: no-store`, idempotentes (200 si ya estaba
  cancelada) y con aviso `reservation_cancelled` para el organizador de reservas web. La
  migración `006_reservation_cancellation_notice.sql` solo ensancha el CHECK de los avisos.

Detalle en [HU-14-implementacion](../docs/backend/HU-14-implementacion.md), TDD-0010 y TDD-0016.

## HU-07 - Agenda del complejo

`GET /api/v1/complexes/{complexId}/agenda?date=AAAA-MM-DD` (Bearer, solo administrador o encargado
asignado) devuelve por cancha los turnos con `reservationId` y las reservas del día con origen,
nombre y teléfono, `cancellable` y horas locales. Ventana hoy..hoy+13, único parámetro `date`.
La grilla pública `/slots` suma `PENDING_MATCH` con `pendingMatch {missingPlayers, level}` (TDD-0009 v3), pero la
agenda arma su propia ocupación y sigue viendo `RESERVED`. Las reservas `open_match` suman `pendingMatch` (estado, nivel
buscado, `missingPlayers` y anotados con nombre, nivel y posición, sin ids ni contacto).

Detalle en [HU-07-implementacion](../docs/backend/HU-07-implementacion.md) y TDD-0015.

## HU-17 - Mis reservas y partidos

`GET /api/v1/me/reservations?view=upcoming|past&limit=20&offset=0` (Bearer, `Cache-Control: no-store`)
lista en `items` las reservas web que organicé (`kind=reservation`) y los partidos en que participo
(`kind=match`, con `role`, `match.status`, `targetLevel` y `missingPlayers`). `view` es obligatorio;
`limit` 1-100 (20 por defecto); `offset` >= 0; cualquier otro parámetro, repetido o vacío da 400.
`cancellable` reutiliza la regla de 4 h de HU-14 y es siempre `false` para partidos. Las reservas
manuales no aparecen y no se exponen contactos ni otros jugadores. No modifica
`GET /api/v1/reservations?date=`, avisos ni cancelaciones.

Detalle en [HU-17-implementacion](../docs/backend/HU-17-implementacion.md) y TDD-0013 (v2).

## HU-13 - Baja de un partido pendiente

`DELETE /api/v1/matches/{matchId}/players/me` requiere Bearer JWT y no acepta body ni query.
El jugador puede salir hasta dos horas antes del inicio, inclusive (RN-03); el organizador
debe cancelar el partido por HU-14. La operación elimina únicamente su inscripción. Si el
partido estaba completo, vuelve a `open`, mientras que la reserva de cancha conserva su
estado `reserved`. El organizador y el resto de los jugadores reciben un aviso interno
`player_left`. La baja repetida de una persona ya no anotada responde 200 sin duplicar
efectos; la transacción bloquea el partido y aplica la baja y los avisos de forma atómica.

`GET /api/v1/match-notices` incluye `kind` (`match_completed` o `player_left`). La migración
`009_match_leave_notices.sql` conserva los avisos existentes y permite nuevas notificaciones
del mismo tipo cuando un partido vuelve a completarse tras una baja.

Diseño: [TDD-0017](../docs/backend/TDDs/TDD-0017-hu-13-bajarse-de-partido-pendiente.md).
Fases y validaciones: [implementación HU-13](HU-13-implementacion.md). La acción de frontend,
cancelar como organizador, vencimiento automático y notificaciones por canales externos no
forman parte de esta etapa.
