# HU-03 Court Administration Adjustments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align HU-03 court administration with the requested shared admin UI, local court photos and feature toggles, green toasts, darker reusable surfaces, and clearer motion.

**Architecture:** Extend the existing local Angular court model/store so each court retains a preview image and selected feature IDs during the current session. Keep upload, validation, preview, and reusable feature switches in the court form; reuse the existing admin sidebar and shared toast, with shared surface colors in global CSS tokens.

**Tech Stack:** Angular standalone components, reactive forms, signals, SCSS, Vitest, Docker frontend image.

**Spec:** Approved in-chat design in this task (2026-10-12).

## Global Constraints

- Frontend only: no backend, database, endpoints, or server infrastructure.
- Keep all HU-03 changes on the existing HU-03 branch.
- Keep components focused and reusable; avoid extensive files and duplicated UI.
- Document phases, main files, validation, and scope limits in Markdown.
- Animations must respect `prefers-reduced-motion` and must not block interaction.
- Use Spanish for user-facing copy and HU-specific commit suggestions.

## Review Focus

- Unsupported, oversized, or cleared image selections do not break create/edit; validate format/size and retain a usable fallback.
- Editing a court preserves and updates its image and switches without mutating other courts.
- Missing image and empty feature selection render cleanly.
- Dialog close timing stays responsive with reduced motion enabled.
- Shared sidebar and green toast styles remain responsive and readable.

---

### Task 1: Court image and feature model

**Files:**

- Modify: `frontend/src/app/courts/court.model.ts`
- Modify: `frontend/src/app/courts/court-preview.store.ts`
- Test: `frontend/src/app/courts/court-preview.store.spec.ts`

**Interfaces:**

- Add a union of feature IDs for illumination, electronic scoreboard, Wi-Fi, and acrylic surface.
- Extend court records/drafts with nullable image data and a list of selected feature IDs.

- [x] Add store tests proving create/update retain image and selected features independently per court.
- [x] Run the focused store tests and confirm the new assertions fail before implementation.
- [x] Extend seeded demo records and CRUD transformations to carry the new fields.
- [x] Run the focused store tests and confirm they pass.

### Task 2: Court form and card presentation

**Files:**

- Modify: `frontend/src/app/courts/court-form.component.ts`
- Modify: `frontend/src/app/courts/court-form.component.html`
- Modify: `frontend/src/app/courts/court-form.component.scss`
- Modify: `frontend/src/app/courts/court-form.component.spec.ts`
- Modify: `frontend/src/app/courts/court-card.component.ts`
- Modify: `frontend/src/app/courts/court-card.component.html`
- Modify: `frontend/src/app/courts/court-card.component.scss`

**Interfaces:**

- Form consumes and emits the extended `CourtDraft`; cards render optional image and selected feature labels.

- [x] Add tests for image/feature draft emission, empty image, and rejected unsupported/oversized images.
- [x] Run focused form tests to confirm the new assertions fail before implementation.
- [x] Add accessible image selection (PNG/JPEG/WebP, 5 MB maximum) with preview/clear action and four reusable feature switches.
- [x] Render selected photo or the existing court illustration, plus selected feature badges.
- [x] Run form/store tests and confirm they pass.

### Task 3: Admin navigation, shared theme, toast, and motion

**Files:**

- Modify: `frontend/src/app/courts/court-admin.page.html`
- Modify: `frontend/src/app/courts/court-admin.page.scss`
- Modify: `frontend/src/app/courts/court-form-dialog.component.scss`
- Modify: `frontend/src/app/complexes/complex-admin-sidebar.component.html`
- Modify: `frontend/src/app/courts/court-admin.page.ts`
- Modify: `frontend/src/app/shared/toast.component.scss`
- Modify: `frontend/src/styles.scss`

**Interfaces:**

- Reuse the current sidebar component from the court page; expose a shared darker-surface token from global styles.

- [x] Add an entry-animation check for the court page and honor reduced motion.
- [x] Add the sidebar to the court admin shell and remove the requested eyebrow labels and court count.
- [x] Apply the shared darker-surface token to the header/cards and change the shared toast to green.
- [x] Increase dialog entrance/exit duration to roughly 420 ms; keep its removal fallback synchronized and reduced-motion-safe.
- [x] Run build and focused tests.

### Task 4: Documentation and delivery verification

**Files:**

- Modify: `docs/CHANGELOG-DEVELOPMENT.md`
- Modify: `docs/phases/phase-05-clubs.md`

- [x] Document UI changes, local-only image/features, files, validation, and backend limits.
- [x] Build the frontend, run focused HU-03 tests, and verify the app in Docker/browser.
- [x] Check responsive layout, keyboard interaction, image preview/clear, toggles, toast color, and reduced motion where the available test tools permit.
- [x] Run `git diff --check` and inspect final scope for frontend-only changes.
