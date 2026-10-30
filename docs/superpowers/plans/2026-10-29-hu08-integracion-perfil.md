# HU-08 Integración del perfil propio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Conectar la edición de `/perfil` con el endpoint autenticado de actualización del perfil y reflejar los datos reales en la sesión y partidos.

**Architecture:** Extender los modelos/servicios de autenticación para enviar el DTO aprobado y actualizar el usuario actual. Adaptar el formulario a los cinco campos persistidos, proteger su ruta y reemplazar la dependencia de perfil ficticio en la presentación de Home.

**Tech Stack:** Angular 21, TypeScript, RxJS, Vitest, Go API ya existente.

**Spec:** `docs/superpowers/specs/2026-10-29-hu08-integracion-perfil-design.md`

## Global Constraints

- Frontend únicamente; no cambiar endpoints, backend, base de datos ni infraestructura.
- Enviar exactamente `name`, `zone`, `level`, `position`, `hand`.
- Mantener componentes pequeños, documentación Markdown y controles accesibles existentes.
- No presentar como persistentes los campos que la API no admite.

## Review Focus

- DTO estricto: evitar enviar email, campos extra, `null` u omisiones.
- Sesión: solo actualizar el usuario si sigue vigente el token que inició la operación.
- Catálogos: una zona válida, niveles del backend y valores opcionales de posición/mano.
- Sin sesión: `/perfil` debe redirigir a `/ingresar`.
- Errores de API: mostrar el error y conservar los cambios del formulario para reintentar.

---

### Task 1: Servicio de actualización tipado y coherente con la sesión

**Files:** `frontend/src/app/auth/auth.model.ts`, `auth-api.service.ts`, `auth-session.service.ts` y sus specs.

- [x] Añadir pruebas para método PUT, DTO exacto, autorización, actualización de usuario en sesión y cierre de sesión durante una respuesta pendiente.
- [x] Ejecutar las pruebas nuevas y confirmar fallo antes de la implementación.
- [x] Implementar `UpdateProfileRequest`, `AuthApiService.updateProfile()` y `AuthSessionService.updateProfile()` con protección contra respuesta de otro token.
- [x] Ejecutar las pruebas de autenticación y construir el frontend.

### Task 2: Formulario conectado, campos compatibles y ruta protegida

**Files:** `profile/player-profile.page.ts`, `profile/player-profile.page.html`, `styles/profile.scss`, `app.routes.ts`, feedback de perfil y specs existentes.

- [x] Cargar el formulario desde `AuthSessionService.currentUser()`.
- [x] Editar solo nombre, zona única, nivel, posición y mano; correo solo lectura; quitar controles de campos no soportados.
- [x] Guardar con estado pendiente, errores legibles y confirmación; preservar navegación a Home tras guardar.
- [x] Proteger `/perfil` con `authGuard`.
- [x] Ejecutar pruebas relevantes y build.

### Task 3: Presentación con datos de sesión y entrega

**Files:** `landing/landing.page.ts`, `landing/landing.page.html`, `landing/match-card.component.ts`, `profile/player-profile.store.ts` (retiro), `docs/phases/hu-08-integracion-perfil.md`.

- [x] Reemplazar datos de perfil local por datos autenticados en Home y tarjetas.
- [x] Documentar fases, archivos, validaciones y límites.
- [x] Ejecutar pruebas de perfil/auth, build y validaciones del API con backend sin modificarlo.
- [x] Reiniciar todos los contenedores y verificar visualmente la ruta.
