# HU-24: Filtrar partidos urgentes

## Alcance

- El filtro **Urgentes** muestra partidos con inicio futuro dentro de una ventana móvil de 24 horas (incluye el límite exacto), siempre que tengan uno o dos lugares libres.
- La fecha y hora de la API se interpretan en la zona del producto, Buenos Aires (UTC−03:00), sin depender de la zona del navegador. Fechas u horas ausentes o inválidas quedan fuera del filtro.
- El estado del filtro es reactivo: **Todos**, **Urgentes** y **Completar grupo** actualizan la grilla sin recargar ni volver a consultar la API.
- Se reutilizan las tarjetas de partidos y se muestra horario, zona, categoría y cantidad de lugares libres. El vacío de **Urgentes** tiene un mensaje propio.
- No se modifica backend ni el contrato de API. HU-24 queda documentada aparte de HU-23.

## Archivos principales

- `frontend/src/app/landing/urgent-match.ts`: validación de elegibilidad urgente y parseo con zona de Buenos Aires.
- `frontend/src/app/landing/landing.page.ts`: filtro reactivo sobre los partidos cargados.
- `frontend/src/app/landing/landing.page.html`: interacción de filtros y estado vacío específico.
- `frontend/src/app/landing/match-card.component.ts` y `.scss`: presentación de la categoría en la tarjeta existente.
- `frontend/src/app/landing/urgent-match.spec.ts`: límites, lugares libres, medianoche, zona horaria y datos inválidos.
- `frontend/src/app/landing/landing.page.spec.ts`: comprobación de cambio inmediato entre filtros.

## Verificaciones

- `npx ng test --include='src/app/landing/urgent-match.spec.ts' --watch=false`: **9 pruebas aprobadas**.
- `npm run build`: aprobado; persisten advertencias de presupuesto y `RouterLink` no usado en `MyReservationsPage`.
- `npm test`: ejecutado, pero el conjunto completo reporta fallos fuera de las pruebas puras nuevas, incluidos `localStorage.clear is not a function` y errores de inicialización de `TestBed` en varias suites de Angular. La suite aislada del criterio urgente sí pasa con el runner de Angular.
- `docker compose build frontend` y `docker compose up -d frontend`: aprobados. El frontend responde HTTP 200 en `http://localhost:8081`.
- Navegador: **Urgentes** vacía la grilla al instante y **Todos** restaura el partido ya cargado. El fixture disponible en el entorno comienza el 2026-11-20 y tiene tres lugares libres, así que se excluye correctamente por estar fuera de ventana y por exceder el máximo de dos lugares. No había en la base un partido próximo con uno o dos lugares para verificar ese caso de manera puntual; queda cubierto por las pruebas con reloj fijo.

## Límites

- La zona de Buenos Aires se aplica como UTC−03:00, el offset civil vigente del producto.
- No se alteraron datos del backend para fabricar casos de navegador.
- No se abrió PR; la validación puntual del equipo queda pendiente.
