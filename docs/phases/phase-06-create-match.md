# Fase 06 — Publicar partido

## Objetivo

Publicar partido futuro de cuatro plazas con creador anotado.

## Historias de usuario relacionadas

HU-04

## Funcionalidades

POST `/api/matches`; validación de club, tiempo y niveles.

## Backend

`backend/internal/matches/`.

## Frontend

Formulario reactivo crear partido.

## Base de datos

Matches y match_players en una transacción.

## Caché

Invalidación al crear cuando exista caché.

## Archivos a crear o modificar

- `backend/internal/matches/`.
- Formulario reactivo crear partido.
- Documentación: `docs/phases/phase-06-create-match.md`, `docs/phases/README.md`, `docs/CHANGELOG-DEVELOPMENT.md`. 

## Criterios de aceptación

Partido nuevo queda OPEN con 1/4 y 3 lugares; rechaza datos inválidos.

## Cómo verificar la fase

Probar POST válido/inválido y consultar registro en PostgreSQL.

## Estado

PENDING

