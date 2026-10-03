# Fase 07 — Buscar partidos

## Objetivo

Búsqueda de partidos OPEN futuros, filtros combinables, orden y paginación backend.

## Historias de usuario relacionadas

HU-05

## Funcionalidades

GET `/api/matches` con `page`, `page_size`, `zone`, `club_id`, `date`, `level`.

## Backend

`backend/internal/matches/`.

## Frontend

MatchCard, MatchFilters, Pagination; filtros en query params.

## Base de datos

Consulta indexada con total filtrado.

## Caché

Se añade en fase 12.

## Archivos a crear o modificar

- `backend/internal/matches/`.
- MatchCard, MatchFilters, Pagination; filtros en query params.
- Documentación: `docs/phases/phase-07-search-matches.md`, `docs/phases/README.md`, `docs/CHANGELOG-DEVELOPMENT.md`. 

## Criterios de aceptación

Filtros sobreviven refresh; no descarga masiva; orden fecha/hora.

## Cómo verificar la fase

Probar filtros, paginación y URL Angular.

## Estado

PENDING

