# HU-17 Mis partidos Implementation Plan

> **For agentic workers:** Execution is authorized by the user. Use the existing Angular and Go conventions.

**Goal:** Present the player's own reservations and matches in a responsive Mis Partidos view aligned with Stitch.

**Architecture:** Angular consumes the authenticated `GET /api/v1/me/reservations` contract already present in `Desarrollo`. Keep reservation cancellation on its existing endpoint and do not create duplicate backend routes or seed/mock personal data.

**Tech Stack:** Angular standalone components, signals, SCSS, Go API already integrated in `Desarrollo`.

**Spec:** Trello HU-17 (`https://trello.com/c/oXCsgyd5`) and backend TDD-0013 (`docs/backend/TDDs/TDD-0013-hu-17-consulta-reservas-propias.md`). Stitch screen: “Mis Partidos - PádelMatch La Plata”.

## Global Constraints

- Show only the authenticated player's reservations and match memberships.
- Keep Próximos and Jugados as the primary views and show persisted reservation/match states.
- Keep the existing cancelability rule and confirmation flow.
- Do not add backend entities or mock records when the API contract already exists.
- Keep Angular components focused, accessible, responsive, and reduced-motion friendly.

## Review Focus

- Empty and error responses remain actionable, with retry and navigation links.
- Cancelled matches and reservations remain classified by the selected time view and visibly distinct.
- Summary values describe only the loaded page and are labeled accordingly.
- Mobile layout stacks the next-turn summary and list without horizontal overflow.

---

### Task 1: Establish a clean full-stack HU branch

**Files:** Git refs only.

- [x] Preserve the prior branch's uncommitted work under a clearly named HU-17 backup branch.
- [x] Create `hu-17-mis-reservas-y-partidos` from updated `Desarrollo`.

### Task 2: Align the player view with Stitch and Trello

**Files:** `frontend/src/app/reservations/my-reservations.page.{ts,html,scss}`, `frontend/src/app/landing/landing-header.component.ts`, `frontend/src/app/app.routes.ts`.

- [x] Keep Próximos/Jugados navigation and current API pagination, loading, error, empty and cancellation behavior.
- [x] Add responsive dashboard composition, next-turn summary, loaded-page counts, and clear reservation/match status chips.
- [x] Name the navigation and page “Mis partidos”.

### Task 3: Document and validate the integrated result

**Files:** `docs/phases/hu-17-mis-reservas-y-partidos.md`.

- [x] Record changed files and scope, note the backend contract inherited from `Desarrollo`, and verify the frontend production build.
- [x] Restart the project's Docker containers for manual review.
