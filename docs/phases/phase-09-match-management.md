# Fase 09 — Editar/cancelar

## Objetivo

Organizador edita o cancela y avisa a participantes.

## Historias de usuario relacionadas

HU-10

## Funcionalidades

PUT `/api/matches/:id`, POST `/api/matches/:id/cancel`.

## Backend

`backend/internal/matches/`.

## Frontend

Formulario edición y confirmación de cancelación.

## Base de datos

Cambio de estado CANCELLED y avisos.

## Caché

Invalidación en fase 12.

## Archivos a crear o modificar

- `backend/internal/matches/`.
- Formulario edición y confirmación de cancelación.
- Documentación: `docs/phases/phase-09-match-management.md`, `docs/phases/README.md`, `docs/CHANGELOG-DEVELOPMENT.md`. 

## Criterios de aceptación

Solo creador modifica; cancelado sale de búsqueda; avisos correctos.

## Cómo verificar la fase

Probar permisos y cambios con dos usuarios.

## Estado

PENDING

