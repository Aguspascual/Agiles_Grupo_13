# Fase 02 — Infraestructura

## Objetivo

Entorno reproducible con Docker Compose, PostgreSQL, Redis, Nginx y variables.

## Historias de usuario relacionadas

-

## Funcionalidades

Compose de cuatro servicios con healthchecks y volumen PostgreSQL.

## Backend

`backend/Dockerfile`, configuración de entorno y conexión.

## Frontend

`frontend/Dockerfile`, `frontend/nginx.conf`.

## Base de datos

Contenedor PostgreSQL con volumen.

## Caché

Contenedor Redis sin persistencia.

## Archivos a crear o modificar

- `backend/Dockerfile`, configuración de entorno y conexión.
- `frontend/Dockerfile`, `frontend/nginx.conf`.
- Documentación: `docs/phases/phase-02-infrastructure.md`, `docs/phases/README.md`, `docs/CHANGELOG-DEVELOPMENT.md`. 

## Criterios de aceptación

`docker compose up --build` inicia los cuatro servicios; refrescar rutas Angular funciona.

## Cómo verificar la fase

`docker compose up --build -d`; `docker compose ps`; abrir `/partidos/123`.

## Estado

PENDING

