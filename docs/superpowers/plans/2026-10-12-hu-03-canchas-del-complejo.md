# HU-03 Canchas del complejo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a responsive frontend demo for managing courts within a selected complex.

**Architecture:** Add a typed local signal store and focused court list/form components under `frontend/src/app/courts/`. Add a nested-by-id route and an entry action on complex cards; keep reservation enforcement visibly demo-only and document backend limits.

**Tech Stack:** Angular standalone components, signals, SCSS, Vitest/Angular unit tests, Docker frontend image.

**Spec:** `docs/phases/phase-05-clubs.md` and Trello HU-03 acceptance criteria.

## Global Constraints

- Frontend only; do not add APIs, backend, database, or server services.
- Follow the existing PádelMatch Stitch design system and responsive admin styling.
- Keep files focused and reusable; document phases, files, validation, and scope in Markdown.
- Any animation must respect `prefers-reduced-motion` and must not block interaction.
- Commits, if requested, include HU-03 and are in Spanish.

## Review Focus

- Future reservation blocks the local demo court removal and explains why.
- Court state is scoped to the selected complex; invalid complex IDs render a recoverable state.
- Empty list, form validation, narrow viewport, and reduced motion remain usable.
- All UI labels/actions are keyboard accessible and announce save/delete feedback.
- No backend or reservation API is introduced by the frontend demo.

## Files

- Create `frontend/src/app/courts/court.model.ts` and `court-preview.store.ts` for typed local demo state.
- Create store tests at `frontend/src/app/courts/court-preview.store.spec.ts`.
- Create `court-admin.page.*`, `court-form-dialog.component.*`, and `court-card.component.*` for route coordination, editing, and reusable cards.
- Modify `frontend/src/app/app.routes.ts`, complex card/page files, and `docs/phases/README.md`, `docs/phases/phase-05-clubs.md`, `docs/CHANGELOG-DEVELOPMENT.md`.

## Tasks

### Task 1: Local court model and store

- [ ] Define `CourtRecord` (`id`, `complexId`, `name`, `covered`, `hasFutureReservations`) and `CourtDraft`.
- [ ] Write tests for per-complex filtering, create/update, allowed removal, and blocked removal; run and observe the tests fail.
- [ ] Implement local signal state with one seeded court that has a future reservation; no persistence or HTTP.
- [ ] Run the focused store test and confirm all pass.

### Task 2: Responsive court management flow

- [ ] Add `/admin/complejos/:complexId/canchas` and a court-management action on each complex card.
- [ ] Implement a focused route page, reusable court card, and create/edit dialog using the existing Stitch palette, typography, cards, and feedback conventions.
- [ ] Cover missing complex, empty list, create/edit, and blocked/successful removal with Angular component tests before implementation where practical.
- [ ] Validate desktop and mobile layouts; honor reduced-motion preferences.

### Task 3: Documentation and verification

- [ ] Update phase status to HU-03 frontend demo complete while backend integration and real reservation rules remain pending.
- [ ] Document files, phases, checks, and frontend-only boundary in the development changelog.
- [ ] Run full frontend tests, production build, and Docker frontend build when available.
- [ ] Verify route interactions and responsive layout in a real browser.
