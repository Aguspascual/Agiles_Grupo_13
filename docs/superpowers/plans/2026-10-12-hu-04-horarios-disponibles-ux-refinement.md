# Plan de implementación — Refinamiento de horarios disponibles (HU-04)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compactar la gestión de canchas y horarios, permitir varias franjas diarias, autoguardar reglas válidas y consultar la disponibilidad fecha por fecha sin límite futuro.

**Architecture:** Reemplazar el único horario de apertura/cierre por colecciones de franjas en las reglas semanales. Un generador puro calculará únicamente los turnos de la fecha seleccionada; el almacenamiento local versionado migrará las reglas v1 y conservará los bloqueos. La página coordinará el editor plegable con autoguardado, la navegación por fecha y las acciones compactas de cada tarjeta.

**Tech Stack:** Angular standalone 21, TypeScript, Reactive Forms, RxJS, signals, Vitest, SCSS, Docker Compose frontend service.

**Spec:** [2026-10-12-hu-04-horarios-disponibles-ux-refinement.md](../specs/2026-10-12-hu-04-horarios-disponibles-ux-refinement.md)

## Global Constraints

- Implement frontend only; do not add endpoints, backend, database changes, or server services.
- Use recurring weekly rules and calculate slots only for the selected date.
- Keep demo persistence in browser `localStorage`; migrate `padelmatch.availability.v1` to `padelmatch.availability.v2` and retain the v1 key as backup.
- Keep Reactivity and UI modules small, reusable, and dependency-free beyond the existing Angular/RxJS stack.
- Preserve dark page background and light cards, responsive behavior, visible focus, and `prefers-reduced-motion` support.
- Autosave only valid edits after a 350 ms quiet period; no Save or Cancel buttons.
- Do not commit; provide a Spanish HU-04 commit suggestion after implementation and verification.
- Update the HU-04 documentation and Frontend Trello checklist after verification; leave Backend checklist untouched.

## Review Focus

1. v1 local data or blocked ids are malformed, future-versioned, or partially valid: migrate safely or fall back without breaking the page. Test in `availability-preview.store.spec.ts`.
2. Intervals overlap, have invalid times, or cannot fit a full 60/90-minute slot: reject the edit and preserve the previous persisted rules. Test in generator validation and form specs.
3. A valid rule is changed and then the page reloads: the updated rule must be present, while an invalid draft must not overwrite it. Test in store and form specs.
4. A selected date crosses month/year boundaries or advances past the former 28-day limit: generate only that date's local slots and keep stable IDs. Test in generator and page specs.
5. The user navigates to today, disables a day, or removes its last interval: prevent browsing into past dates and provide a valid route to an unavailable day. Test in page and editor specs.

## File Map

- `frontend/src/app/availability/availability.model.ts`: weekly rules, intervals, and calculated slots.
- `frontend/src/app/availability/availability-generator.ts`: pure rule validation and one-date slot generation.
- `frontend/src/app/availability/availability-preview.store.ts`: v2 serialization, v1 migration, local rule autosaves, and blocked IDs.
- `frontend/src/app/availability/weekly-schedule-form.component.*`: collapsed weekly editor, per-day interval controls, validation, debounced valid-change output.
- `frontend/src/app/availability/availability-calendar.component.*`: selected-date-only agenda and accessible blocked/unblocked actions.
- `frontend/src/app/availability/court-availability.page.*`: date navigation, editor autosave coordination, compact title, notices, and court selector.
- `frontend/src/app/courts/court-card.component.*`: single accessible Actions menu containing schedule, edit, and deactivation actions.
- Related specs beside each component; `court-card.component.spec.ts` for the action menu.
- `docs/IMPLEMENTATION-PLAN.md`, `docs/phases/README.md`, and `docs/phases/phase-06-available-hours.md`: HU-04 behavior, validation, frontend-only limits, and demo instructions.

---

### Tarea 1: Modelar varias franjas y generar una sola fecha

**Files:**
- Modify: `frontend/src/app/availability/availability.model.ts`
- Modify: `frontend/src/app/availability/availability-generator.ts`
- Modify: `frontend/src/app/availability/availability-generator.spec.ts`

**Interfaces:**
- `ScheduleInterval`: `{ id: string; opensAt: string; closesAt: string }`.
- `WeeklyScheduleRule`: `{ weekday: Weekday; enabled: boolean; intervals: ScheduleInterval[]; durationMinutes: 60 | 90 }`.
- `generateAvailabilitySlots(courtId: string, rules: WeeklyScheduleRule[], date: Date, blockedSlotIds?: ReadonlySet<string>): AvailabilitySlot[]`.
- Export `isValidWeeklySchedule(value: unknown): value is WeeklyScheduleRule[]` for reuse by the store.

- [x] **Step 1: Write failing generator tests** for two same-day intervals (09:00–13:00 and 17:00–22:00), 60/90-minute duration, disabled days, stable IDs, local dates, and exclusion of partial final slots.
- [x] **Step 2: Write failing validation tests** for duplicate weekdays, invalid/empty enabled rules, intervals that overlap, invalid times, and intervals shorter than one full slot.
- [x] **Step 3: Run the focused Angular/Vitest spec** with `npm test -- --watch=false --include=src/app/availability/availability-generator.spec.ts`; confirm the new contract fails before implementation.
- [x] **Step 4: Implement the rule and interval types, pure validator, and one-date generator.** Sort interval copies by opening time before generating; never mutate persisted input. Preserve existing slot IDs as `courtId:YYYY-MM-DD:HH:mm` so saved block IDs continue matching.
- [x] **Step 5: Rerun the focused spec** and confirm all interval, validation, and date-boundary cases pass.

### Tarea 2: Migrar la persistencia local a v2 y guardar varias franjas

**Files:**
- Modify: `frontend/src/app/availability/availability-preview.store.ts`
- Modify: `frontend/src/app/availability/availability-preview.store.spec.ts`

**Interfaces:**
- `rulesFor(courtId: string): WeeklyScheduleRule[]`.
- `saveRules(courtId: string, rules: WeeklyScheduleRule[]): void`.
- `slotsFor(courtId: string, date: Date): AvailabilitySlot[]`.
- `toggleBlocked(slotId: string): void`.
- `persistenceAvailable: Signal<boolean>` indicates whether local storage writes are working.

- [x] **Step 1: Write failing store tests** for v2 interval round-trip, migration of an active v1 rule to one interval, preservation of blocked IDs, no rewrite of the v1 backup key, invalid v1 fallback, and unavailable/throwing localStorage.
- [x] **Step 2: Run the focused Angular/Vitest spec** with `npm test -- --watch=false --include=src/app/availability/availability-preview.store.spec.ts`; confirm migration and interval cases fail.
- [x] **Step 3: Implement versioned reads and writes.** Read valid v2 first; when absent, validate v1, map each active day's `opensAt`/`closesAt` to one interval and preserve duration/blocked IDs, then write v2 while leaving v1 intact. Use seven disabled empty defaults when neither version is usable.
- [x] **Step 4: Validate rules through `isValidWeeklySchedule`;** write only complete valid snapshots. Update `persistenceAvailable` if `localStorage` is unavailable or throws, and keep the session usable in memory.
- [x] **Step 5: Run the focused store spec** and verify restored schedules and block toggles across store instances.

### Tarea 3: Crear el editor semanal compacto con autoguardado

**Files:**
- Modify: `frontend/src/app/availability/weekly-schedule-form.component.ts`
- Modify: `frontend/src/app/availability/weekly-schedule-form.component.html`
- Modify: `frontend/src/app/availability/weekly-schedule-form.component.scss`
- Modify: `frontend/src/app/availability/weekly-schedule-form.component.spec.ts`

**Interfaces:**
- Input `rules: WeeklyScheduleRule[]` initializes or switches the editor's court rules.
- Output `rulesChange: WeeklyScheduleRule[]` emits a complete valid weekly snapshot after 350 ms without edits.
- Output `saveError: string` emits validation or persistence feedback only when needed.

- [x] **Step 1: Write failing editor tests** for a collapsed initial accordion, expand/collapse behavior, adding/removing intervals, disabled days, preventing removal of the last interval while a day stays enabled, invalid overlap and boundary errors, no emission for invalid edits, and one debounced emission for valid edits.
- [x] **Step 2: Run the focused Angular/Vitest spec** with `npm test -- --watch=false --include=src/app/availability/weekly-schedule-form.component.spec.ts`; verify new controls and autosave behavior fail.
- [x] **Step 3: Implement the collapsed «Configuración semanal» panel** and compact per-day disclosures. Add accessible controls for day activation and adding/removing interval rows; keep each day’s 60/90-minute duration selector.
- [x] **Step 4: Validate each enabled day's intervals** for valid local times, at least one complete slot, and no overlap. On invalid drafts, retain the form values, show field-associated errors, and do not emit a saved snapshot.
- [x] **Step 5: Debounce `form.valueChanges` by 350 ms** and emit only valid snapshots. Prevent parent echoes of identical saved rules from resetting the form or stealing focus; remove Save/Cancel outputs and buttons.
- [x] **Step 6: Verify editor tests** for keyboard operation, focus visibility, `aria-expanded`, error associations, autosave debounce, and reduced-motion styles.

### Tarea 4: Mostrar y navegar una sola fecha

**Files:**
- Modify: `frontend/src/app/availability/availability-calendar.component.ts`
- Modify: `frontend/src/app/availability/availability-calendar.component.html`
- Modify: `frontend/src/app/availability/availability-calendar.component.scss`
- Modify: `frontend/src/app/availability/availability-calendar.component.spec.ts`
- Modify: `frontend/src/app/availability/court-availability.page.ts`
- Modify: `frontend/src/app/availability/court-availability.page.html`
- Modify: `frontend/src/app/availability/court-availability.page.scss`
- Modify: `frontend/src/app/availability/court-availability.page.spec.ts`

**Interfaces:**
- Page `selectedDate: Signal<Date>` starts at local today; `previousDay()` stops at today; `nextDay()` advances without a 28-day cap.
- Page derives `slots` by calling `slotsFor(courtId, selectedDate())`.
- Calendar input `slots: AvailabilitySlot[]`; output `toggleBlocked: string`.

- [x] **Step 1: Write failing page/calendar tests** for one visible date only, no count, navigating next beyond 28 days, previous disabled at today, date changes across month/year, current-day empty state, and toggling a slot.
- [x] **Step 2: Run focused page and calendar specs** with `npm test -- --watch=false --include=src/app/availability/court-availability.page.spec.ts --include=src/app/availability/availability-calendar.component.spec.ts` and confirm the new assertions fail.
- [x] **Step 3: Implement date navigation** with labeled previous/next buttons, a readable selected-date heading, no turn counter, and only the selected date's computed slots.
- [x] **Step 4: Connect editor `rulesChange` to the local store** without reinitializing the editor on each autosave. Show one short green success toast per valid saved snapshot; show a single nonblocking notice if persistence is unavailable.
- [x] **Step 5: Remove the breadcrumb, «Demo local», old explanatory copy, browser-storage status sentence, and Save/Cancel controls.** Keep the «Horarios disponibles» title and court selector.
- [x] **Step 6: Run focused page/calendar specs** and confirm navigation, autosave, date-specific generation, and block persistence pass.

### Tarea 5: Reemplazar las acciones de la cancha por un menú accesible y compacto

**Files:**
- Modify: `frontend/src/app/courts/court-card.component.ts`
- Modify: `frontend/src/app/courts/court-card.component.html`
- Modify: `frontend/src/app/courts/court-card.component.scss`
- Modify: `frontend/src/app/courts/court-card.component.spec.ts`

**Interfaces:**
- Preserve the existing `edit` and `remove` outputs and the schedule route.
- Add an `actionsOpen` state and close/keyboard handlers local to the card.

- [x] **Step 1: Write failing card tests** for one «Acciones» trigger, menu items Horarios/Editar/Dar de baja, no colliding action buttons, Escape close, and proper edit/remove output values.
- [x] **Step 2: Run `npm test -- --watch=false --include=src/app/courts/court-card.component.spec.ts`** and confirm the menu assertions fail.
- [x] **Step 3: Implement a compact button-driven menu** with `aria-haspopup`, `aria-expanded`, labeled menu actions, outside/selection close behavior, Escape close with focus return, and responsive positioning that stays within the card viewport.
- [x] **Step 4: Run the focused card spec** and verify keyboard and action behavior.

### Tarea 6: Documentar, verificar y actualizar el checklist Frontend de HU-04

**Files:**
- Modify: `docs/IMPLEMENTATION-PLAN.md`
- Modify: `docs/phases/README.md`
- Modify: `docs/phases/phase-06-available-hours.md`
- Modify: this plan’s checkboxes as evidence is collected.

- [x] **Step 1: Write the phase documentation** for multiple intervals, per-day generation, autosave, v1→v2 migration, manual test route, frontend-only scope, and remaining backend recommendation.
- [x] **Step 2: Run the full Vitest suite** with `cd frontend; npm test -- --watch=false`; require all test files and cases to pass.
- [x] **Step 3: Run the Angular build** with `cd frontend; npm run build`; require successful production bundle generation.
- [x] **Step 4: Validate Docker frontend only** with `docker compose config --quiet` and `docker compose build frontend`; do not add or start backend services.
- [ ] **Step 5: Manually verify in the browser** at desktop and mobile widths: card menu actions, v1 migration, two daily intervals, autosave/reload, invalid-overlap feedback, one-day navigation past 28 days, block/unblock, no overflow, keyboard focus, and reduced motion. Desktop flows were exercised in the browser; the available browser tool did not expose viewport resizing, so direct mobile-width inspection remains pending.
- [x] **Step 6: Run `git diff --check` and review status/diff**; ensure changes stay within HU-04 and components remain focused.
- [x] **Step 7: Update the HU-04 Frontend checklist in Trello** after evidence was complete; two existing Frontend item descriptions were clarified and the third was already complete. Leave the Backend checklist unchanged.
- [x] **Step 8: Provide the Spanish commit suggestion** `HU-04: mejorar horarios y acciones de canchas en el frontend`; do not create a commit.
