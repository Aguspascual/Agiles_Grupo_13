# HU-00 Inicio con datos reales — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reemplazar todo dato de demostración de Inicio por clubes y partidos persistidos, usando las APIs existentes del frontend.

**Architecture:** `LandingPage` consulta en paralelo los servicios públicos existentes de clubes y partidos y mantiene estados explícitos de carga, error y vacío. Las tarjetas reciben modelos derivados de respuestas reales; las cifras se calculan sobre esos conjuntos y los campos que la API no ofrece se omiten.

**Tech Stack:** Angular standalone, TypeScript, RxJS, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-30-hu00-inicio-datos-reales-design.md`

## Global Constraints

- Solo frontend; no modificar backend, esquema, contratos ni infraestructura.
- No mostrar fixtures ni cifras, fotografías, ratings o disponibilidad de prueba.
- Reutilizar `ComplexApiService.listPublic()` y `MatchApiService.list()`.
- Mantener navegación responsive y accesible con estados carga/error/vacío.
- La visita directa a `/partidos` inicia sin filtros; solo los filtros enviados desde Inicio se aplican como búsqueda explícita.

## Review Focus

- Listados vacíos: Inicio muestra estados vacíos y no conserva ejemplos locales.
- Fallo de una API: informar error y permitir reintentar sin ocultar silenciosamente el fallo.
- Visitante sin sesión: mostrar recomendaciones generales de registros reales.
- Usuario con nivel: priorizar partidos reales de nivel compatible sin inventar resultados.
- Búsqueda explícita: parámetros enviados desde Inicio aplican filtros; navegación directa mantiene filtros vacíos.

---

### Task 1: Estado y datos reales de Inicio

**Files:**
- Modify: `frontend/src/app/landing/landing.page.ts`
- Modify: `frontend/src/app/landing/landing.page.html`
- Modify: `frontend/src/app/landing/landing.page.spec.ts`

**Interfaces:** consume `ComplexApiService.listPublic(): Observable<PublicComplex[]>`, `MatchApiService.list(): Observable<MatchPreview[]>`, y `AuthSessionService.currentUser()`.

- [x] Escribir pruebas fallidas para llamadas a ambas APIs, indicadores calculados de sus respuestas, carga/error/reintento y ausencia de tarjetas mock cuando las respuestas son vacías.
- [x] Ejecutar `npm test -- --watch=false --include='src/app/landing/landing.page.spec.ts'` y confirmar fallos por datos estáticos actuales.
- [x] Reemplazar `HOME_MATCHES`, `RECOMMENDED_MATCHES` y `FEATURED_CLUBS` en `LandingPage` por estado recibido de APIs; usar métricas derivadas con nombres acotados y eliminar recomendaciones artificiales.
- [x] Agregar estados `loading`, `error`, `ready` y renderizado vacío en el HTML, con controles de reintento.
- [x] Repetir la prueba enfocada y confirmar su aprobación.

### Task 2: Tarjetas de clubes y partidos sin datos de presentación falsos

**Files:**
- Modify: `frontend/src/app/landing/club-card.component.ts`
- Modify: `frontend/src/app/landing/club-card.component.scss`
- Modify: `frontend/src/app/landing/landing.page.html`
- Modify: `frontend/src/app/landing/landing.data.ts`
- Modify: `frontend/src/app/landing/match-card.component.ts`
- Test: `frontend/src/app/landing/landing.page.spec.ts`

**Interfaces:** club cards consumen `PublicComplex`; las tarjetas de partidos consumen partidos de `MatchApiService`.

- [x] Añadir prueba que compruebe nombre/dirección/zona reales y que Inicio no renderice rating, cantidad de turnos ni `img` local cuando la API no trae esos campos.
- [x] Rehacer la tarjeta de club para usar únicamente `PublicComplex`; enlazar a sus turnos por ID y retirar dependencias de `ClubPreview` y `FEATURED_CLUBS`.
- [x] Hacer condicional la imagen en tarjeta de partido y no pasar a Inicio `image` local usada como placeholder por el mapper.
- [x] Reemplazar la cancha destacada estática por un panel de club real, o un estado sin clubes, sin nombre ni dirección hardcodeados.
- [x] Ejecutar pruebas enfocadas HU-00.

### Task 3: Filtros enviados desde Inicio

**Files:**
- Modify: `frontend/src/app/landing/landing.page.ts`
- Modify: `frontend/src/app/landing/landing.page.html`
- Modify: `frontend/src/app/landing/match-search.page.ts`
- Test: `frontend/src/app/landing/match-search.hu11.spec.ts` y/o `match-search.page.spec.ts`

**Interfaces:** query params de navegación `zona`, `nivel` y `fecha`; listado backend `GET /api/v1/matches`.

- [x] Añadir pruebas de que el formulario Home genera filtros explícitos y que abrir `/partidos` sin dichos parámetros deja todos los filtros vacíos.
- [x] Mantener `zona` filtrada sobre resultados backend, validar `nivel` con niveles admitidos y convertir la fecha del formulario a un valor que la búsqueda pueda reconocer.
- [x] Ejecutar pruebas enfocadas de Inicio y búsqueda.

### Task 4: Documentación y validación de entrega

**Files:**
- Create: `docs/phases/hu-00-inicio-datos-reales.md`

- [x] Documentar fases, archivos principales, endpoints consumidos, validaciones y límites (sin imágenes/rating/estadísticas globales porque no están en la API).
- [x] Ejecutar `npm test -- --watch=false` y `npm run build`.
- [x] Corregir fallos introducidos por HU-00 y registrar de forma separada cualquier prueba antigua de otras HU que ya falle.
- [x] Ejecutar `git diff --check` y revisar que no se modificaron archivos backend, Docker ni infraestructura.
