# Fase 04 — Registro e inicio de sesión

## Objetivo

Registro e inicio de sesión de jugadores.

## Historias de usuario relacionadas

HU-01

## Funcionalidades

Endpoints de autenticación, hash seguro de contraseñas y sesión.

## Backend

`backend/internal/auth/`, `users/`, `middleware/`.

## Frontend

Pantallas de ingreso y registro; validaciones del frontend y navegación de demo para probar la HU siguiente.

## Base de datos

Usuarios. El perfil declarado corresponde a HU-08 según el tablero actualizado.

## Caché

Sin cambios.

## Archivos a crear o modificar

- `backend/internal/auth/`, `middleware/`.
- Pantallas login y registro; servicio de autenticación, interceptor y guard al integrar backend.
- Documentación: `docs/phases/phase-04-auth-profile.md`, `docs/phases/README.md`, `docs/CHANGELOG-DEVELOPMENT.md`. 

## Criterios de aceptación

Registro e inicio de sesión con credenciales persistidas y seguras. El frontend está implementado; la autenticación real permanece pendiente.

## Cómo verificar la fase

Probar validaciones Angular; al integrar backend, probar registro, inicio de sesión y persistencia de sesión.

## Estado

PARCIAL — frontend HU-01 implementado y verificado. La API, sesión real, almacenamiento persistente y pruebas integradas quedan pendientes.

