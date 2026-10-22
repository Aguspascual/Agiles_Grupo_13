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

## Ajustes visuales y de registro HU-01 — 12/10/2026

- Login y registro comparten el fondo gris verdoso de administración y conservan tarjetas blancas.
- El registro se compactó, se eliminaron los textos promocionales pedidos y las zonas habituales permiten seleccionar una o varias. El selector personalizado de nivel inicial permanece visible aunque todavía no se hayan elegido zonas.
- El formulario de login también redujo sus espacios, controles y altura general.
- La prueba manual no transmite ni persiste estos datos; la creación de cuenta y autenticación reales quedan pendientes.
- Archivos principales: `frontend/src/app/auth/register.page.*`, `frontend/src/app/auth/login.page.ts`, `frontend/src/styles/_auth.scss`, `_register.scss` y `_motion.scss`.
- Validación: build de Angular y Docker; suite completa de 23 pruebas; verificación manual en navegador del fondo, textos retirados, multi-selección y selector fijo.

