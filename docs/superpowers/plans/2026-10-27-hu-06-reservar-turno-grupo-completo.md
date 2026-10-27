# HU-06 Reservar turno con grupo completo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reservar un slot disponible desde `/partidos/crear` con un grupo de cuatro personas y reflejarlo como reservado en la grilla pública HU-05.

**Architecture:** Agregar un flujo standalone Angular por pasos que consume `SlotGridService`, y extender el singleton `BookingPreviewStore` para registrar reservas locales tipadas con exclusión por `slotId`. La ruta y el CTA del header llevan al flujo; no se agrega agenda administrativa ni backend.

**Tech Stack:** Angular 21 standalone, Angular Router, Reactive Forms, signals, RxJS, Vitest existente.

**Spec:** `docs/superpowers/specs/2026-10-27-hu-06-reservar-turno-grupo-completo-design.md`

## Global Constraints

- Cambios exclusivamente frontend; no modificar backend, endpoints, base de datos, Docker ni infraestructura.
- Reservas creadas viven en memoria de la SPA; no afirmar coordinación entre clientes o persistencia tras recarga.
- El grupo tiene exactamente cuatro jugadores; el responsable de contacto puede ser uno de ellos.
- La agenda administrativa se difiere a otra HU.
- Componentes enfocados, texto en español, responsive, accesible por teclado y con foco visible.
- Animaciones cortas respetan `prefers-reduced-motion`.
- No crear commit, push, merge ni PR.

## Review Focus

- Slot ya tomado localmente entre selección y confirmación: prueba de store confirma que se rechaza sin reemplazar la primera reserva.
- Reservas locales sobre datos demo: prueba de prioridad verifica que la nueva reserva es la que ve la grilla.
- Horario pasado, bloqueado o ya reservado: selector/página los excluye y la confirmación valida otra vez.
- Formulario incompleto o mal formado: validadores evitan avanzar y anuncian errores.
- Volver/actualizar ruta durante los pasos: la selección no puede producir una reserva para un complejo, fecha o cancha diferente al resumen.

---

## File Map

- Modify `frontend/src/app/bookings/booking.model.ts`: tipar jugador/grupo y permitir guardar contacto y metadatos de reserva completa sin alterar reservas demo.
- Modify `frontend/src/app/bookings/booking-preview.store.ts`: añadir operación de reserva local, consulta por slot y resultado explícito de conflicto.
- Modify `frontend/src/app/bookings/booking-preview.store.spec.ts`: cubrir registro, colisión y compatibilidad/precedencia.
- Modify `frontend/src/app/slot-grid/slot-grid.builder.spec.ts`: fijar que una reserva creada se refleja como estado `reserved`.
- Create `frontend/src/app/create-match/create-match.page.ts/html/scss`: coordinar ruta por pasos, estado seleccionado, errores y resultado exitoso.
- Create `frontend/src/app/create-match/slot-selection-step.component.ts/html/scss`: elegir complejo, fecha, cancha y slot disponible desde servicios/fixtures existentes.
- Create `frontend/src/app/create-match/group-details-step.component.ts/html/scss`: formulario Reactivo para contacto responsable y cuatro nombres.
- Create `frontend/src/app/create-match/reservation-review-step.component.ts/html/scss`: resumen accesible de complejo, cancha, día, intervalo y grupo.
- Create colocated specs for store/page/steps following repo test conventions if test scope is approved.
- Modify `frontend/src/app/app.routes.ts`: lazy route `/partidos/crear` before wildcard.
- Modify `frontend/src/app/landing/landing-header.component.ts`: change “Crear partido” destination to `/partidos/crear`.
- Create `docs/phases/hu-06-reservar-turno-grupo-completo.md`: phases, files, validations and backend/admin integration pending.

## Task 1: Tipar y registrar reservas locales

**Files:** `booking.model.ts`, `booking-preview.store.ts`, colocated store specs, `slot-grid.builder.spec.ts`.

- [ ] **Step 1: Add failing store tests** for successful booking creation, duplicate `slotId` conflict preserving the first booking, and newly created booking taking precedence over a demo booking.
- [ ] **Step 2: Run the focused booking tests** and verify the new expectations fail.
- [ ] **Step 3: Add typed reservation group/contact fields** and `BookingPreviewStore.createReservation(record)` returning a discriminated success/conflict result; keep demo fixtures unchanged.
- [ ] **Step 4: Add a grid builder assertion** that the stored full booking renders `reserved`; run focused specs and verify they pass.

## Task 2: Build the selection step and route shell

**Files:** new `create-match` page and slot selection component; `app.routes.ts`; relevant page specs.

- [ ] **Step 1: Add failing component tests** for selecting an existing complex/date/court and listing only future `available` slots from `SlotGridService`; assert loading, empty and error states.
- [ ] **Step 2: Run the focused specs** and verify the route/step behavior fails before implementation.
- [ ] **Step 3: Implement the accessible responsive slot selection component** using `ComplexPreviewStore`, `CourtPreviewStore` and `SlotGridService`; do not duplicate schedule generation.
- [ ] **Step 4: Add the lazy `/partidos/crear` route and page shell** with step state, back navigation, selection preservation and error announcement.
- [ ] **Step 5: Run focused specs** and verify selection and navigation behavior pass.

## Task 3: Collect group and confirm

**Files:** new group form and review step components; `create-match.page.ts/html/scss`; relevant specs.

- [ ] **Step 1: Add failing tests** for invalid contact/group preventing progress, valid four-player group enabling review, and review showing selected complex/court/date/start/end.
- [ ] **Step 2: Run focused specs** and verify the assertions fail.
- [ ] **Step 3: Implement Reactive Forms validation** for responsible name, phone and exactly four player names, with inline labels/errors and focus management between steps.
- [ ] **Step 4: Implement review and confirmation**; revalidate that the slot remains selectable, register the typed reservation once, then render confirmation or local-conflict state with a way to choose another slot.
- [ ] **Step 5: Run focused specs** and verify validation, review and confirmation behavior pass.

## Task 4: Entry point, docs and verification

**Files:** `landing-header.component.ts`, `docs/phases/hu-06-reservar-turno-grupo-completo.md`, touched feature files.

- [ ] **Step 1: Add an assertion** that the header’s “Crear partido” link points to `/partidos/crear`; update the link.
- [ ] **Step 2: Document phases, main files, frontend-only limits, local demo behavior, deferred admin agenda and future backend concurrency integration.**
- [ ] **Step 3: Execute the approved checks**: focused specs, full frontend test suite and `npm run build` from `frontend/`; report commands and results.
- [ ] **Step 4: Restart the existing containers for manual review** without changing Docker or compose files, and provide the route and click-through steps to try the flow.

## Execution Notes

- Preserve the current branch `feature/front-hu06-reservar-turno-grupo-completo` and any existing work.
- User explicitly requested no backend; despite the original Trello criterion, this HU stops at the public grid and leaves administrative agenda display for another HU as approved.
- User’s established instruction requires restarting containers after frontend changes; if Docker control requires permission, request it only after the code and validation are ready.

## Addendum: modal Stitch compartido

La entrada final es el modal de Stitch “Nuevo Partido - Modal de Reserva - PádelMatch La Plata”, integrado globalmente y abierto desde ambos CTA de inicio y header. La URL `/partidos/crear` permanece como alias que abre el mismo modal. Se mantiene el alcance frontend aprobado.

- [x] Reutilizar el selector de complejos, canchas y horarios disponibles.
- [x] Integrar preferencias, contacto y cuatro participantes en secciones modulares.
- [x] Reutilizar resumen de reserva, confirmación local y grilla HU-05.
- [x] Probar apertura desde las dos entradas y validar formulario de grupo.
- [x] Ejecutar build y reconstruir/reiniciar el contenedor frontend para prueba manual.
