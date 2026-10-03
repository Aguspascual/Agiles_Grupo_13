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

PENDING

