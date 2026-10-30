# Fase 04 — Registro e inicio de sesión (Auth y perfil)

## Objetivo

Registro e inicio de sesión de jugadores. El registro persiste los datos iniciales del perfil; la edición completa del perfil queda fuera del alcance actual.

## Historias de usuario relacionadas

HU-01. HU-02 y la integración de autenticación/perfil no forman parte de esta entrega.

## Funcionalidades

- Backend: endpoints de registro, inicio de sesión y consulta del usuario autenticado; contraseñas protegidas con bcrypt y sesión mediante JWT.
- Frontend: registro y login Angular consumen la API Go real; el servicio HTTP, la sesión JWT y la restauración con `/me` están implementados y probados.

## Backend

Implementación en `backend/internal/auth/` y `backend/cmd/api/`, dentro del monolito modular actual. El registro inserta usuario y perfil en una misma transacción. La API requiere `DATABASE_URL` y `JWT_SECRET` de al menos 32 bytes; `PORT` es opcional y usa `8000` por defecto.

Endpoints:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me` (requiere Bearer token)

La migración es `backend/migrations/001_auth.sql`. No se crean tablas `zones` ni `user_zones`.

## Frontend

Las pantallas Angular están en `frontend/src/app/auth/`; registro y login envían los DTOs definidos por la API Go, muestran errores HTTP y estado de carga, guardan la sesión y navegan al inicio. El guard valida autenticación para rutas protegidas. Los proveedores sociales y la recuperación de contraseña no están disponibles.

## Base de datos

`users` y `player_profiles`. El registro guarda ambas filas transaccionalmente. La edición del perfil y la consulta pública de jugador no se consideran completas en esta fase; el tablero ubica el perfil editable en HU-08.

## Caché

Sin cambios.

## Archivos principales

- Backend: `backend/internal/auth/`, `backend/internal/database/`, `backend/migrations/001_auth.sql` y `backend/cmd/api/main.go`.
- Frontend: `frontend/src/app/auth/`, `frontend/src/styles/`, `frontend/public/images/`, `frontend/Dockerfile` y `frontend/nginx.conf`.
- Seguimiento: `docs/phases/phase-04-auth-profile.md` y `docs/CHANGELOG-DEVELOPMENT.md`.

## Criterios y verificación

- Backend: validar registro e inicio de sesión, hash bcrypt, JWT y persistencia en PostgreSQL.
- Frontend: validar formularios y presentación con la suite Angular y el build de producción.
- La API y la integración Angular de registro/login se validaron mediante HTTP real y PostgreSQL 17. La automatización visual del navegador queda pendiente; la suite Angular registra aparte tres fallas preexistentes de HU-04.

## Estado

**PARCIAL.** Registro, login, sesión y restauración Angular están conectados con Go y PostgreSQL y validados por HTTP real. No se declara HU-01 Done hasta que el equipo documente formalmente la decisión de una sola zona y se complete la revisión visual en navegador.

## Ajustes visuales y de registro HU-01 — 12/10/2026

- Login y registro comparten el fondo gris verdoso de administración y conservan tarjetas blancas.
- En la versión visual de 12/10 el registro permitía seleccionar varias zonas; el 29/10 se adaptó a una sola zona para coincidir con el DTO vigente del backend. La aprobación formal de esa regla debe quedar asentada por el equipo antes de cerrar el criterio.
- El formulario de login redujo sus espacios, controles y altura general.
- En la revisión visual del 12/10 el formulario no transmitía ni persistía datos; esa limitación fue resuelta en la integración HTTP de 29/10.
- Archivos principales: `frontend/src/app/auth/register.page.*`, `frontend/src/app/auth/login.page.ts`, `frontend/src/styles/_auth.scss`, `_register.scss` y `_motion.scss`.
- La documentación del frontend registra build, suite y verificación visual; los antecedentes y limitaciones de cada ejecución se conservan en `docs/CHANGELOG-DEVELOPMENT.md`.

## Integración HTTP HU-01 — 29/10/2026

- Angular incorpora DTOs de autenticación, cliente HTTP para `/api/v1/auth`, almacenamiento de sesión, interceptor Bearer y guard de autenticación. Login usa únicamente `email` y `password`; tras el éxito guarda el JWT y vuelve a `/`.
- Al iniciar la aplicación, `GET /api/v1/auth/me` valida el JWT almacenado. Un 401 limpia la sesión; los errores temporales conservan el token para permitir reintentar. Rutas administrativas exigen sesión validada; la autorización por rol sigue correspondiendo al backend.
- `Recordarme` guarda el JWT en `localStorage`; desactivado lo guarda en `sessionStorage`. El JWT emitido por el backend vence a las 24 horas. No hay renovación automática; al revalidar un token vencido se cierra la sesión. El almacenamiento accesible desde JavaScript puede exponerse ante XSS.
- Angular usa `/api` con `frontend/proxy.conf.json`; Nginx reenvía `/api/` al servicio Compose `backend:8000`.
- Se verificó HTTP real a través del frontend Nginx en Docker Compose aislado: registro HTTP 201, login, `/me` autenticado, `/me` sin JWT HTTP 401 y frontend HTTP 200; el usuario persistió en la PostgreSQL 17 propia de ese proyecto temporal. También pasaron `go test -count=1 ./...` con `TEST_DATABASE_URL` sobre PostgreSQL 17 y `go vet ./...`.
- `npm run build` pasó. `npm test -- --watch=false`: 112 pruebas pasaron y 3 fallaron en HU-04; las mismas 3 fallas se reprodujeron en un worktree limpio de `origin/Desarrollo`.
- La ruta `/perfil` de HU-08 permanece disponible tras el merge y su prueba de ruta pasa. La pantalla sigue usando estado local de demostración, permite varias zonas e incluye `Los Hornos`, que el backend de registro no admite. Se preservó la ruta sin imponerle un guard nuevo ni convertir la lista; coordinar con el equipo si debe requerir autenticación y cómo alinear el perfil antes de conectarlo a la API.
- El registro Angular ya usa selección única de zona y `POST /api/v1/auth/register`; confirma la contraseña solo localmente y envía el DTO exacto. En el alta, el JWT se guarda en `sessionStorage` y se navega al inicio. La decisión de zona única está autorizada para implementar, pero falta que el equipo la documente formalmente antes de cerrar el criterio.
- No se modificaron Go, migraciones ni esquema PostgreSQL. La integración no está publicada: sin commit, push ni PR.
- El encabezado obtiene nombre, nivel e iniciales de `AuthSessionService.currentUser`; sin sesión ofrece Ingresar/Registrarse y no muestra el perfil ficticio de `PlayerProfileStore`. La confirmación de logout llama `AuthSessionService.logout()`, limpia la sesión local y navega a `/ingresar`. No se invalida el JWT en servidor porque no existe ese endpoint.
- No se modificaron el formulario ni el store de perfil HU-08. La persistencia real de HU-08 con PostgreSQL continúa pendiente; `/perfil` conserva su comportamiento actual y la cuestión de proteger esa ruta sigue por coordinar.
- La ruta de administración sin sesión sigue redirigiendo a `/ingresar`; pruebas del header: 3 aprobadas. Suite Angular: 115 aprobadas y las mismas 3 fallas preexistentes de HU-04; `npm run build` pasó.

## Corrección de respuestas de sesión anteriores (PR #23)

- Rama: `feature/front-hu01-corregir-sesion`, basada en la [PR #23](https://github.com/Aguspascual/Agiles_Grupo_13/pull/23).
- `auth-session.service.ts` solo aplica el usuario o cierra sesión si sigue vigente el token que inició `/me`. Una respuesta anterior devuelve la identidad actual a sus suscriptores.
- `auth.interceptor.ts` no elimina la sesión actual ante un `401` de otro token.
- `auth-session.service.spec.ts` cubre respuestas anteriores `200` y `401` después de un login nuevo, un `401` protegido anterior y una restauración posterior al logout.
- RED observado: las cuatro regresiones fallaron antes del arreglo; las seis pruebas existentes de sesión pasaron.
- GREEN: las diez pruebas de sesión pasaron; `npm run build` y `git diff --check` pasaron.
- Suite completa: 119 aprobadas y tres fallas HU-04. La base exacta de la PR (`b4dd3a0`) reprodujo las mismas tres fallas, con 115 aprobadas. No se corrigieron por quedar fuera de alcance.
- Entorno de pruebas: copia temporal con Node 22 y `npm ci --ignore-scripts --legacy-peer-deps`, sin modificar el lockfile.
- Verificación independiente: diez pruebas de sesión aprobadas en una copia temporal nueva; sin bloqueadores atribuibles al cambio.
- Alcance limitado al frontend HU-01. Sin cambios en backend, dependencias, contratos HTTP, permisos de rutas ni perfil HU-08.
