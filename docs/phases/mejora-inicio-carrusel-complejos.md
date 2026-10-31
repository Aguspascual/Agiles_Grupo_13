# Mejora: Inicio con carrusel de canchas y complejos con imagen

Rama: `mejora/frontend-ajustes-visuales`. Incluye cambios de backend autorizados por el usuario para esta mejora.

## Fases

1. **Backend público.** `GET /api/v1/public/courts` lista las canchas de los complejos activos (nombre, tipo, características, complejo, zona, dirección e `imageUrl`). `GET /api/v1/public/complexes` suma `imageUrl` (solo si el complejo tiene imagen; sin imagen mantiene los cuatro campos de siempre). Las imágenes se sirven como binario cacheable en `GET /api/v1/public/complexes/{id}/image` y `GET /api/v1/public/courts/{id}/image`, con `?v=` para renovarlas al editarlas. No se expone ningún dato personal.
2. **Carrusel "Complejo registrado".** La tarjeta del hero pasa las canchas registradas con su imagen, nombre, tipo, complejo, dirección, zona y características. Avanza sola cada 5 segundos, se pausa con el mouse o el foco, tiene flechas y puntos, y una cancha sin imagen usa la del complejo. Con `prefers-reduced-motion` no hay avance automático ni transición. Sin canchas, muestra el primer complejo.
3. **Complejos publicados.** Cada tarjeta muestra la imagen del complejo, zona, nombre, dirección y cantidad de canchas.
4. **Header.** Se quitó el acceso "Clubes" de la barra y del menú.
5. **Filtros en una fila.** Zona, fecha y nivel quedan en la misma fila también en pantallas de hasta 820px (800x600); el botón Buscar partidos ocupa el ancho completo debajo.
6. **Enlaces.** "Ver turnos" y la flecha del carrusel apuntan a `/clubes/:id/turnos` (antes iban a `/complejos/...`, una ruta que no existe).

## Archivos principales

- Backend: `backend/internal/catalog/*` (nuevo), `backend/internal/slots/{model,postgres}.go`, `backend/cmd/api/routes.go`
- Frontend: `frontend/src/app/landing/featured-courts.component.*` (nuevo), `club-card.component.*`, `landing.page.{ts,html}`, `landing-header.component.ts`, `frontend/src/app/complexes/{complex.model,complex-api.service}.ts`
- Tests: `backend/internal/catalog/catalog_test.go`, `landing.integration.spec.ts`, `landing-header.component.spec.ts`

## Validaciones

- `go vet ./...` y `go test` de `catalog`, `slots` y `cmd/api`: correctos.
- Pruebas Angular de landing (integración y header), club y complejos: en verde.
- Revisión visual en Chrome a 800x600 y 1920x1080; el carrusel avanza solo.

## Límites de alcance

- `landing.page.spec.ts` ya fallaba antes de estos cambios (peticiones sin simular); no se modificó.
- La prueba HTTP contra PostgreSQL de los nuevos endpoints no se agregó: se verificaron con la API real levantada.