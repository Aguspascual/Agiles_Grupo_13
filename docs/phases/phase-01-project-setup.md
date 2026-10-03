# Fase 01 — Project Setup

## Objetivo

Estructura Angular standalone y monolito Go modular, documentación y convenciones.

## Historias de usuario relacionadas

-

## Funcionalidades

`frontend/` y `backend/` con arranque mínimo; rutas y componentes base.

## Backend

`backend/go.mod`, `backend/cmd/api/main.go`, `backend/internal/`

## Frontend

`frontend/angular.json`, `frontend/src/app/`, `frontend/package.json`

## Base de datos

Sin cambios.

## Caché

Sin cambios.

## Archivos a crear o modificar

- `backend/go.mod`, `backend/cmd/api/main.go`, `backend/internal/`
- `frontend/angular.json`, `frontend/src/app/`, `frontend/package.json`
- Documentación: `docs/phases/phase-01-project-setup.md`, `docs/phases/README.md`, `docs/CHANGELOG-DEVELOPMENT.md`. 

## Criterios de aceptación

La estructura existe; ambos proyectos compilan; documentación de fases y README disponibles.

## Cómo verificar la fase

`npm run build` en frontend y `go test ./...` en backend.

## Estado

PENDING

