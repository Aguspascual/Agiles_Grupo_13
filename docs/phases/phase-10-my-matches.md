# Fase 10 — Mis partidos

## Objetivo

Partidos propios próximos/pasados con estado.

## Historias de usuario relacionadas

HU-11

## Funcionalidades

GET `/api/users/me/matches` paginado.

## Backend

`backend/internal/users/`, `matches/`.

## Frontend

Pantalla Mis partidos reutilizando MatchCard/StatusBadge.

## Base de datos

Consulta por match_players.

## Caché

Sin cambios.

## Archivos a crear o modificar

- `backend/internal/users/`, `matches/`.
- Pantalla Mis partidos reutilizando MatchCard/StatusBadge.
- Documentación: `docs/phases/phase-10-my-matches.md`, `docs/phases/README.md`, `docs/CHANGELOG-DEVELOPMENT.md`. 

## Criterios de aceptación

Incluye organizados y unidos sin duplicados; próximos/pasados.

## Cómo verificar la fase

Probar usuario con partidos de varios estados.

## Estado

PENDING

