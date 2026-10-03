# Fase 03 — Base de datos

## Objetivo

Migraciones versionadas, integridad relacional y datos de desarrollo.

## Historias de usuario relacionadas

-

## Funcionalidades

Runner de migraciones y seed idempotente.

## Backend

`backend/internal/database/`, `backend/migrations/`.

## Frontend

Sin cambios.

## Base de datos

Tablas users, player_profiles, clubs, matches, match_players, notifications; FKs, checks, índices y datos ficticios.

## Caché

Sin cambios.

## Archivos a crear o modificar

- `backend/internal/database/`, `backend/migrations/`.
- Sin cambios.
- Documentación: `docs/phases/phase-03-database.md`, `docs/phases/README.md`, `docs/CHANGELOG-DEVELOPMENT.md`. 

## Criterios de aceptación

Migraciones se aplican al iniciar; seeds incluyen clubes y partidos OPEN/FULL/CANCELLED.

## Cómo verificar la fase

Levantar PostgreSQL; inspeccionar tablas y ejecutar pruebas de migración.

## Estado

PENDING

