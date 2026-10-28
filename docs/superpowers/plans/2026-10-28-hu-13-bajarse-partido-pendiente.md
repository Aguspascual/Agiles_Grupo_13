# HU-13 Frontend Implementation Plan

> **For agentic workers:** Use the approved inline implementation in this session. Keep HU-13 isolated from other user stories.

**Goal:** Permitir que un jugador simule que se baja de un partido pendiente y dejar visible el lugar libre.

**Architecture:** Agregar una tarjeta de participación de demostración en `/partidos`, aislada en un componente y respaldada por un store local tipado. La acción solicitará confirmación y, al aceptar, bajará el conteo de jugadores de 4/4 a 3/4; avisos reales quedan fuera hasta contar con backend.

**Tech Stack:** Angular standalone, TypeScript, signals y Vitest existentes.

**Spec:** Tarjeta Trello HU-13: https://trello.com/c/C1HTIYGW/40-%F0%9F%9F%A1-hu-13-bajarse-de-un-partido-pendiente

## Global Constraints

- Frontend únicamente, sin API ni persistencia de servidor.
- Respetar componentes pequeños, accesibilidad y el estilo existente.
- Documentar fases y límites de integración en `docs/phases`.

## Review Focus

- El estado inicial representa un partido pendiente completo con el jugador actual incluido.
- Cancelar el diálogo deja intacta la participación.
- Confirmar libera exactamente un lugar y vuelve a mostrar el partido como pendiente (3/4).
- El flujo anuncia localmente la baja; no afirma que avisos reales hayan sido enviados.
- El diálogo funciona con teclado y foco visible.

## Files

- Create: `frontend/src/app/bookings/pending-match-membership.store.ts` — estado local de la demo.
- Create: `frontend/src/app/bookings/pending-match-membership-card.component.ts` and `.scss` — tarjeta, confirmación y acción.
- Modify: `frontend/src/app/landing/match-search.page.ts` and `.html` — incorporar tarjeta en Buscar partidos.
- Test: `frontend/src/app/bookings/pending-match-membership.store.spec.ts` and component behavior in `landing.page.spec.ts`.
- Create: `docs/phases/hu-13-bajarse-partido-pendiente.md` — fases, validaciones y límites.

## Tasks

1. Add failing store tests for initial full membership and leaving (3/4, one vacancy); implement the signal store and run focused tests.
2. Add the accessible reusable card with cancel/confirm behavior and success status; cover the confirmation and cancel paths.
3. Integrate into `/partidos`, document the demo/backend boundary, run focused tests and Angular build, then restart the frontend container.
