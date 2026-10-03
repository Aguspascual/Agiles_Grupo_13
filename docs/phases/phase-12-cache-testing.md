# Fase 12 — Caché y testing

## Objetivo

Caché Redis de búsquedas e integración final.

## Historias de usuario relacionadas

-

## Funcionalidades

Clave normalizada por filtros y página, TTL 60s; invalidación simple.

## Backend

`backend/internal/cache/`, pruebas de integración.

## Frontend

Pruebas de componentes y formularios prioritarios.

## Base de datos

PostgreSQL permanece fuente de verdad.

## Caché

Redis solo cachea GET `/api/matches`.

## Archivos a crear o modificar

- `backend/internal/cache/`, pruebas de integración.
- Pruebas de componentes y formularios prioritarios.
- Documentación: `docs/phases/phase-12-cache-testing.md`, `docs/phases/README.md`, `docs/CHANGELOG-DEVELOPMENT.md`. 

## Criterios de aceptación

Tests relevantes pasan y Compose construye los cuatro servicios.

## Cómo verificar la fase

`go test ./...`, `npm test`, `npm run build`, `docker compose up --build`.

## Estado

PENDING

