# Fase 05 — Clubes

## Objetivo

Listado público y administración mínima por ADMIN.

## Historias de usuario relacionadas

HU-03

## Funcionalidades

CRUD `/api/clubs` con control de rol.

## Backend

`backend/internal/clubs/`.

## Frontend

ClubCard, listado y formulario admin simple.

## Base de datos

Tabla clubs y seeds La Plata.

## Caché

Sin cambios.

## Archivos a crear o modificar

- `backend/internal/clubs/`.
- ClubCard, listado y formulario admin simple.
- Documentación: `docs/phases/phase-05-clubs.md`, `docs/phases/README.md`, `docs/CHANGELOG-DEVELOPMENT.md`. 

## Criterios de aceptación

Todos consultan clubes; solo ADMIN crea, edita y elimina.

## Cómo verificar la fase

Probar GET público y CRUD con/sin token ADMIN.

## Estado

PENDING

