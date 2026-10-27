# HU-10 Match Detail Modal Implementation Plan

> **For agentic workers:** Use this plan task-by-task with `superpowers:executing-plans`.

**Goal:** Let players open a detailed view of a pending match from `/partidos`.

**Architecture:** Keep the existing match search and its local fixture model. Add a focused dialog component that receives one `MatchPreview`; the page owns which match is selected, and the card exposes a detail event only in search mode.

**Tech Stack:** Angular 21 standalone components, TypeScript, SCSS.

**Spec:** Trello HU-10: https://trello.com/c/BB89evJe/37-%F0%9F%9F%A1-hu-10-ver-partidos-pendientes and Stitch “Detalle del Partido - PádelMatch La Plata”.

## Global Constraints

- Frontend only; no backend, database, endpoint, or infrastructure changes.
- Reuse existing search cards and match fixtures; keep the view responsive and accessible.
- Keep changes within HU-10 and document phases in Markdown.
- Keep animation brief and respect `prefers-reduced-motion`.

## Review Focus

- Any match in the visible results can open its own details.
- The player list displays category and position for every listed fixture player.
- The dialog closes via its close button, backdrop, and Escape key.
- Mobile viewport can scroll the dialog without trapping the page.
- Home cards retain their existing demo action behavior.

### Task 1: Typed match details and card event

**Files:** `frontend/src/app/landing/landing.data.ts`, `frontend/src/app/landing/match-card.component.ts`.

- [ ] Add fixture court and player position fields; expose an opt-in detail event for `/partidos` cards only.

### Task 2: Responsive detail dialog

**Files:** Create `frontend/src/app/landing/match-detail-dialog.component.ts`, `.html`, `.scss`.

- [ ] Render summary, court diagram, player details, available seats, and club facts from the selected fixture.
- [ ] Add keyboard dismissal, focus on open, focus restoration by the parent, and reduced-motion behavior.

### Task 3: Wire the search page and document HU

**Files:** Modify `frontend/src/app/landing/match-search.page.ts`, `.html`; create `docs/phases/hu-10-detalle-partido.md`.

- [ ] Open the selected match from a result card and close the dialog back to the same trigger.
- [ ] Run the production build, verify the running frontend route, and recreate the frontend container.
