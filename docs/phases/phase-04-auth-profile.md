# Fase 04 — Auth y perfil

## Objetivo

Registro, login, JWT, perfil declarado editable y consulta pública de jugador.

## Historias de usuario relacionadas

HU-01 / HU-02

## Funcionalidades

Endpoints auth y users, hash bcrypt, middleware JWT.

## Backend

`backend/internal/auth/`, `users/`, `middleware/`.

## Frontend

Pantallas login, registro y perfil; servicios, interceptor y guard.

## Base de datos

Users y player_profiles.

## Caché

Sin cambios.

## Archivos a crear o modificar

- `backend/internal/auth/`, `users/`, `middleware/`.
- Pantallas login, registro y perfil; servicios, interceptor y guard.
- Documentación: `docs/phases/phase-04-auth-profile.md`, `docs/phases/README.md`, `docs/CHANGELOG-DEVELOPMENT.md`. 

## Criterios de aceptación

Contraseña hasheada; sesión persiste; perfil editable sin ranking.

## Cómo verificar la fase

Probar registro/login/perfil con API y formularios Angular.

## Estado

IN PROGRESS — backend HU-01 implementado; integración con frontend HU-01 y HU-02 quedan fuera de este cambio.

## Implementación backend HU-01

- `POST /api/v1/auth/register` valida los datos del formulario, normaliza email, recorta `zone`, acepta únicamente la lista acordada y exige el compromiso `fairPlay`.
- `POST /api/v1/auth/login` verifica bcrypt y devuelve JWT firmado con HS256.
- `GET /api/v1/auth/me` requiere un JWT válido y devuelve el usuario de la sesión.
- La migración versionada `backend/internal/auth/migrations/001_auth.sql` crea `users` y `player_profiles`; ambas filas de registro se insertan en una transacción. No existen tablas `zones` ni `user_zones`.
- Configuración requerida: `DATABASE_URL` y `JWT_SECRET` de 32 bytes como mínimo; `PORT` es opcional y usa `8000` por defecto.
- Verificación: `gofmt` y `go mod tidy` ejecutados; `go test ./...` pasa.

