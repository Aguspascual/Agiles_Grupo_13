# Fase 05 — Complejos y canchas

## Objetivo

Administración de complejos y encargados (HU-02); gestión de canchas (HU-03).

## Historias de usuario relacionadas

HU-02 / HU-03

## Funcionalidades

CRUD de complejos, asignación de encargados y CRUD de canchas con control de acceso por complejo.

## Backend

`backend/internal/clubs/`.

## Frontend

Listado, tarjetas y formulario reusable para alta/edición/baja de complejos y asignación de encargados.

## Base de datos

Tablas de complejos, encargados y canchas con seeds de La Plata.

## Caché

Sin cambios.

## Archivos a crear o modificar

- `backend/internal/clubs/`.
- Vistas y formularios admin para complejos, encargados y canchas.
- Documentación: `docs/phases/phase-05-clubs.md`, `docs/phases/README.md`, `docs/CHANGELOG-DEVELOPMENT.md`. 

## Criterios de aceptación

El administrador puede crear, editar y dar de baja complejos y asignar encargados. Un encargado solo puede gestionar sus complejos. La baja de canchas con reservas futuras se rechaza.

## Cómo verificar la fase

Probar CRUD y permisos con/sin usuario encargado, además de reglas de baja de canchas.

## Estado

PARCIAL — frontend de HU-02 implementado y probado en modo de demostración local. Backend, persistencia e HU-03 quedan pendientes.

