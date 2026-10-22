# Fase 04 — Registro e inicio de sesión (Auth y perfil)

## Objetivo

Registro e inicio de sesión de jugadores. El registro persiste los datos iniciales del perfil; la edición completa del perfil queda fuera del alcance actual.

## Historias de usuario relacionadas

HU-01. HU-02 y la integración de autenticación/perfil no forman parte de esta entrega.

## Funcionalidades

- Backend: endpoints de registro, inicio de sesión y consulta del usuario autenticado; contraseñas protegidas con bcrypt y sesión mediante JWT.
- Frontend: pantallas de ingreso y registro, validaciones locales y navegación de demostración. Las pantallas aún no están conectadas a la API.

## Backend

Implementación en `backend/internal/auth/` y `backend/cmd/api/`, dentro del monolito modular actual. El registro inserta usuario y perfil en una misma transacción. La API requiere `DATABASE_URL` y `JWT_SECRET` de al menos 32 bytes; `PORT` es opcional y usa `8000` por defecto.

Endpoints:

- `POST /api/v1/auth/register`
- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me` (requiere Bearer token)

La migración es `backend/migrations/001_auth.sql`. No se crean tablas `zones` ni `user_zones`.

## Frontend

Las pantallas Angular están en `frontend/src/app/auth/`; los estilos compartidos están en `frontend/src/styles/`. Incluyen validaciones, preferencias de perfil inicial, estados informativos de vista previa, diseño responsive y animaciones que respetan `prefers-reduced-motion`. El envío no transmite ni persiste credenciales y no crea una sesión real. La integración con los endpoints, el servicio, interceptor y guard quedan pendientes.

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
- La prueba integrada de registro e inicio de sesión desde Angular queda pendiente hasta conectar el frontend con la API; esta entrega no se describe como funcionalidad de extremo a extremo.

## Estado

**PARCIAL.** El backend de autenticación HU-01 y las pantallas frontend están implementados. Angular todavía opera en modo local de demostración y no consume los endpoints del backend. La integración y la verificación de extremo a extremo quedan pendientes.

## Ajustes visuales y de registro HU-01 — 12/10/2026

- Login y registro comparten el fondo gris verdoso de administración y conservan tarjetas blancas.
- El registro se compactó, se eliminaron los textos promocionales pedidos y las zonas habituales permiten seleccionar una o varias. El selector de nivel inicial permanece visible aunque todavía no se hayan elegido zonas.
- El formulario de login redujo sus espacios, controles y altura general.
- La prueba manual no transmite ni persiste estos datos; la creación de cuenta y la autenticación reales quedan pendientes de integración.
- Archivos principales: `frontend/src/app/auth/register.page.*`, `frontend/src/app/auth/login.page.ts`, `frontend/src/styles/_auth.scss`, `_register.scss` y `_motion.scss`.
- La documentación del frontend registra build, suite y verificación visual; los antecedentes y limitaciones de cada ejecución se conservan en `docs/CHANGELOG-DEVELOPMENT.md`.
