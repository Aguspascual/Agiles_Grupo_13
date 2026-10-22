# HU-00: plan de implementación de páginas públicas

> **Para agentes de implementación:** usar la subskill `superpowers:executing-plans` para ejecutar este plan tarea por tarea. Cada paso usa casillas (`- [x]`) para registrar el avance.

**Objetivo:** Ajustar Home y Buscar partidos, agregar la pantalla pública Clubes y trasladar los accesos de demo a la tarjeta HU-00 de Trello.

**Arquitectura:** Mantener la funcionalidad en la experiencia Angular actual y conservar los datos locales. Agregar imágenes locales a `MatchPreview`. Crear un directorio con búsqueda local usando `ClubPreview` y compartir header/footer; cargar `/clubes` de forma diferida para mantener el bundle inicial bajo presupuesto. Trello recibe las rutas en la descripción actual de HU-00, sin cambios en sus checklists Frontend y Backend.

**Tecnologías:** Angular 21, componentes standalone, Angular Router, HTML, SCSS, Vitest, servicio Docker del frontend y Trello MCP.

**Diseño:** `docs/superpowers/specs/2026-10-13-hu-00-public-pages-design.md`

## Restricciones generales

- Solo frontend; no agregar APIs, backend, base de datos, persistencia ni cambios a infraestructura de servidor.
- Mantener el alcance de HU-00; Mis partidos corresponde a HU-17 y queda fuera de esta rama.
- Conservar el diseño responsive y respetar `prefers-reduced-motion` si se modifican animaciones.
- Mantener componentes enfocados y reutilizables; no agregar dependencias.
- Documentar fases, archivos principales, validaciones y límites de alcance en Markdown.
- El commit final debe identificar HU-00 y estar escrito en español.

## Nota de pruebas existente

En el sandbox, Vitest no llega a resolver `@angular/core` ni puede renombrar su caché temporal. Con permiso elevado, el runner sí inicia y reveló tres fallas previas en HU-04 y una aserción de texto en HU-00. Se corrigió la aserción HU-00 como parte del trabajo; no cambiar la configuración del runner por errores del sandbox ni mezclar arreglos de HU-04 en esta historia. Registrar las tres fallas HU-04 que sigan al final.

## Enfoques de revisión

- El aumento de escala puede desbordar o comprimir los controles móviles: revisar anchos de 320 px y 375 px luego de los cambios visuales.
- Una tarjeta puede recibir una imagen faltante o texto alternativo vacío: comprobar que cada partido de muestra tenga imagen local y descripción útil.
- El acceso directo a `/clubes` podría caer en el redirect de login: probar la ruta directa y el enlace del header.
- Quitar los accesos de Home podría perder rutas de demo: comparar la lista en Trello con `app.routes.ts` y releer la tarjeta luego de actualizarla.
- Los filtros de Clubes podrían dejar una pantalla vacía: verificar un estado sin resultados que conserve un mensaje y estructura claros.

---

### Task 1: quitar los accesos de demo del Home y actualizar sus pruebas

**Archivos:**

- Modificar: `frontend/src/app/landing/landing.page.spec.ts`
- Modificar: `frontend/src/app/landing/landing.page.html`
- Modificar: `frontend/src/app/landing/landing.page.ts`
- Eliminar: `frontend/src/app/landing/demo-links-card.component.ts`
- Eliminar: `frontend/src/app/landing/demo-links-card.component.html`
- Eliminar: `frontend/src/app/landing/demo-links-card.component.scss`

**Interfaces:**

- Usa `LandingPage` y las rutas actuales.
- Resultado: `LandingPage` deja de importar o renderizar `DemoLinksCardComponent`.

- [x] **Paso 1: escribir la prueba que falla**
  - En `landing.page.spec.ts`, reemplazar `muestra accesos directos copiables a todas las pantallas actuales` por una comprobación de que `[data-demo-links]` no existe.
- [x] **Paso 2: ejecutar la prueba y confirmar el fallo**
  - Desde `frontend`: `npm test -- --watch=false --include=src/app/landing/landing.page.spec.ts`
  - Esperado: la nueva comprobación falla mientras la plantilla aún muestra la tarjeta.
- [x] **Paso 3: quitar el componente del Home**
  - Eliminar su import, su referencia standalone y `<app-demo-links-card />`; quitar los tres archivos del componente porque el listado pasará a Trello.
- [x] **Paso 4: ejecutar la prueba enfocada**
  - Ejecutar: `npm test -- --watch=false --include=src/app/landing/landing.page.spec.ts`
  - Esperado: Home ya no muestra accesos de demo y las pruebas existentes pasan.

### Task 2: agregar imágenes locales a las tarjetas de partidos

**Archivos:**

- Modificar: `frontend/src/app/landing/landing.data.ts`
- Modificar: `frontend/src/app/landing/match-card.component.ts`
- Modificar: `frontend/src/app/landing/match-card.component.scss`
- Modificar: `frontend/src/app/landing/landing.page.spec.ts`

**Interfaces:**

- `MatchPreview` agrega `image: string` e `imageAlt: string`.
- `MatchCardComponent` usa ambas propiedades y muestra la imagen cuando `searchMode` está activo.
- Las recomendaciones de Home mantienen su presentación compacta actual; la imagen se agrega solo a las tarjetas de Buscar partidos.

- [x] **Paso 1: agregar aserciones de imagen**
  - Comprobar que cada tarjeta en Buscar partidos contiene una imagen con `src` y `alt` descriptivo.
- [x] **Paso 2: ejecutar la prueba y confirmar el fallo**
  - Ejecutar desde `frontend`: `npm test -- --watch=false --include=src/app/landing/landing.page.spec.ts`
  - Esperado: falla porque los datos y la plantilla aún no exponen las imágenes.
- [x] **Paso 3: agregar datos de imagen y presentación en búsqueda**
  - Asignar a cada `MatchPreview` una imagen local existente y un texto alternativo que identifique el club.
  - Mostrar la imagen recortada solo en modo búsqueda y definir tamaño responsive y `object-fit` en el SCSS del componente.
- [x] **Paso 4: ejecutar la prueba enfocada**
  - Ejecutar: `npm test -- --watch=false --include=src/app/landing/landing.page.spec.ts`
  - Esperado: las tarjetas de búsqueda contienen imagen y alt descriptivo; las tarjetas de Home conservan su presentación compacta.

### Task 3: corregir textos y ampliar la escala de Home y Buscar partidos

**Archivos:**

- Modificar: `frontend/src/app/landing/landing.page.html`
- Modificar: `frontend/src/app/landing/landing.page.spec.ts`
- Modificar: `frontend/src/app/landing/match-search.page.html`
- Modificar: `frontend/src/styles/_landing.scss`
- Modificar: `frontend/src/styles/_match-search.scss`

**Interfaces:** No hay cambios en TypeScript; se mantienen las secciones y métricas dentro de sus componentes actuales.

- [x] **Paso 1: agregar pruebas de texto**
  - Comprobar que Home muestra `CLUBES ASOCIADOS`, `CATEGORÍAS DISPONIBLES` y `2da a 8va`, y que ya no contiene `CLUBES ASOCIADOS LP`, `NIVEL VERIFICADO APA` ni `A TU MEDIDA`.
  - Comprobar que Buscar partidos ya no muestra `MATCHMAKING EN VIVO EN LA PLATA`.
- [x] **Paso 2: ejecutar las pruebas y confirmar que las nuevas aserciones fallan**
  - Ejecutar: `npm test -- --watch=false --include=src/app/landing/landing.page.spec.ts`
- [x] **Paso 3: cambiar los textos y la escala**
  - Actualizar las métricas según el diseño y quitar los dos rótulos solicitados.
  - Aumentar alrededor de 20% el tamaño visual de Home y Buscar partidos dentro de cada pantalla, con ancho compensado y conservando los puntos de corte; revisar cuidadosamente el resultado responsive.
- [x] **Paso 4: ejecutar las pruebas enfocadas**
  - Ejecutar: `npm test -- --watch=false --include=src/app/landing/landing.page.spec.ts`
  - Esperado: pasan las nuevas aserciones de texto y las pruebas existentes de comportamiento.

### Task 4: crear la pantalla pública Clubes y su ruta

**Archivos:**

- Crear: `frontend/src/app/landing/club-directory.page.ts`
- Crear: `frontend/src/app/landing/club-directory.page.html`
- Crear: `frontend/src/app/landing/club-directory.page.scss`
- Modificar: `frontend/src/app/app.routes.ts`
- Modificar: `frontend/src/app/landing/landing-header.component.ts`
- Modificar: `frontend/src/app/landing/landing-footer.component.ts`
- Modificar: `frontend/src/app/landing/landing.page.html`
- Modificar: `frontend/src/app/landing/landing.page.spec.ts`

**Interfaces:**

- `ClubDirectoryPage` es standalone, atiende `/clubes`, consume `FEATURED_CLUBS` y comparte header y footer. Angular carga la pantalla de forma diferida.
- El enlace `Clubes` del header y `Ver los 18 clubes` de Home navegan a `/clubes`.
- Los filtros usan datos locales; no agregan login ni favoritos persistentes.

- [x] **Paso 1: escribir pruebas que fallen para la ruta y la pantalla**
  - Comprobar que `/clubes` resuelve a `ClubDirectoryPage`, muestra la pantalla pública y lista clubes.
  - Comprobar que cada club tiene imagen local y alt descriptivo, que existe un estado sin resultados y que header/Home enlazan a `/clubes`.
- [x] **Paso 2: ejecutar las pruebas y confirmar el fallo**
  - Ejecutar desde `frontend`: `npm test -- --watch=false --include=src/app/landing/clubs.page.spec.ts --include=src/app/landing/landing.page.spec.ts`
- [x] **Paso 3: implementar la pantalla Clubes**
  - Replicar la pantalla `Clubes - PádelMatch La Plata` de Stitch con cabecera, controles de exploración y grilla responsive usando `FEATURED_CLUBS`.
  - Registrar `/clubes` antes del comodín, actualizar enlaces de header/Home/footer y mostrar un mensaje accesible si ningún club coincide con el filtro.
- [x] **Paso 4: ejecutar las pruebas enfocadas**
  - Ejecutar: `npm test -- --watch=false --include=src/app/landing/clubs.page.spec.ts --include=src/app/landing/landing.page.spec.ts`
  - Esperado: ruta directa, navegación, imágenes locales y estado vacío pasan.

### Task 5: agregar URLs de demo a la tarjeta compartida HU-00 en Trello

**Registro externo:** tarjeta `🟡 HU-00: Landing pública` — <https://trello.com/c/d1cnqjaX/84-%F0%9F%9F%A1-hu-00-landing-p%C3%BAblica>

**Interfaces:** agregar una sección `Accesos directos de demostración` al final de la descripción actual. No modificar los criterios de aceptación ni los checklists Frontend/Backend.

- [x] **Paso 1: leer la descripción vigente y las rutas disponibles**
  - Consultar la tarjeta y sus checklists justo antes de editar; obtener todas las rutas definidas en `app.routes.ts`, incluida `/clubes`.
- [x] **Paso 2: agregar los enlaces locales copiables**
  - Agregar cada ruta como `http://localhost:8081<ruta>` (puerto declarado en `docker-compose.yml`) bajo una etiqueta clara, preservando toda la descripción previa.
- [x] **Paso 3: verificar la modificación en Trello**
  - Volver a leer la tarjeta y comprobar las URLs, criterios previos y checklists Frontend/Backend.

### Task 6: documentar y verificar HU-00 de punta a punta

**Archivos:**

- Modificar: `docs/phases/phase-00-landing.md`
- Verificar: `frontend/src/app/landing/landing.page.spec.ts`
- Verificar: `frontend/src/app/landing/landing.page.spec.ts`

- [x] **Paso 1: ejecutar pruebas y build de producción**
  - Desde `frontend`, ejecutar `npm test -- --watch=false` y `npm run build`.
  - Esperado: Vitest ejecuta la suite y la compilación Angular de producción finaliza sin errores.
- [x] **Paso 2: verificar Docker y las pantallas en navegador**
  - Reconstruir y ejecutar solo el servicio frontend existente.
  - Probar `/`, `/partidos` y `/clubes` en escritorio; revisar escala, fotos, copy, navegación e imágenes. Probar viewports móviles de 320/375 px si el navegador ofrece control de viewport.
  - Confirmar que las animaciones respetan `prefers-reduced-motion`.
- [x] **Paso 3: documentar la entrega**
  - Actualizar `docs/phases/phase-00-landing.md` con fases realizadas, archivos principales, validaciones y límites de datos locales/front-only.
- [x] **Paso 4: preparar un único commit HU-00**
  - Dejar preparado el mensaje en español para que el equipo lo use al crear el commit HU-00.
  - Mensaje sugerido: `HU-00: mejorar landing y sumar pantalla pública de clubes`.

## Límite de HU-17

La pantalla Stitch `Mis Partidos` no se implementa en este plan. Pertenece a la tarjeta HU-17 (`Mis reservas y partidos`) y requiere su propia rama y documentación.
