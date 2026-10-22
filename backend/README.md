# Backend HU-01 y HU-02

API Go para registro e inicio de sesión, con PostgreSQL como almacenamiento.

## Trabajo en equipo

- Elegir una HU en Trello, registrarse en la tarjeta y avisar por el grupo.
- Crear la rama desde `Desarrollo` actualizado: `feature/descripcion`, por ejemplo `feature/horarios-disponibles`.
- Usar commits atómicos `HU-XX: verbo en infinitivo + qué se hizo`; no subir `node_modules` ni archivos `.env`.
- Abrir PR a `Desarrollo` con título `HU-XX (back): nombre de la historia`, link a Trello, qué cambia y cómo probarlo. Requiere una aprobación de otro integrante backend.
- Con aprobación y validaciones correctas, el autor integra con **Create a merge commit**, elimina la rama cuando no queden dependientes y pega el link de la PR en Trello.

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
- `GET /health`: responde `204` cuando el proceso está activo.

`zone` acepta únicamente Casco Urbano, Gonnet, City Bell, San Carlos, Tolosa, Villa Elisa o Berisso / Ensenada. Se recortan espacios al inicio y final. El registro crea `users` y `player_profiles` en una misma transacción. La migración no crea tablas `zones` ni `user_zones`.

## HU-02 — Complejos

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
