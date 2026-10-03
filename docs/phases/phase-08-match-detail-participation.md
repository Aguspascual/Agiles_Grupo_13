# Fase 08 — Detalle y participación

## Objetivo

Detalle público, sumarse/bajarse, FULL automático y notificaciones internas.

## Historias de usuario relacionadas

HU-06 / HU-07 / HU-08 / HU-09

## Funcionalidades

GET detalle, POST join, DELETE leave y notificaciones; transacciones con bloqueo.

## Backend

`backend/internal/matches/`, `notifications/`.

## Frontend

Detalle, jugadores, aviso de nivel, confirmación y avisos.

## Base de datos

`SELECT ... FOR UPDATE` impide 5/4; transiciones OPEN/FULL.

## Caché

Invalidación en fase 12.

## Archivos a crear o modificar

- `backend/internal/matches/`, `notifications/`.
- Detalle, jugadores, aviso de nivel, confirmación y avisos.
- Documentación: `docs/phases/phase-08-match-detail-participation.md`, `docs/phases/README.md`, `docs/CHANGELOG-DEVELOPMENT.md`. 

## Criterios de aceptación

Último lugar solo una vez; creador no abandona; cuatro avisos al completar.

## Cómo verificar la fase

Test de concurrencia PostgreSQL y flujos join/leave/detalle.

## Estado

PENDING

