# Registro de desarrollo — HU-01

## Alcance y fase

Entrega de frontend para la **HU-01: Registro e inicio de sesión**, correspondiente a la fase 04 del MVP (Auth y perfil). Se implementaron las pantallas y estados visuales de Stitch para ingresar y registrarse, con textos en español rioplatense.

El cambio cubre únicamente la interfaz y validación local de formularios. No agrega backend, base de datos, endpoints, almacenamiento de credenciales, inicio de sesión real ni alta persistida de cuentas. La fase 04 permanece parcial: HU-02 y la integración de autenticación/perfil no están incluidas. Las fases 01 a 03 tampoco se marcaron como completadas.

## Fases ejecutadas

1. **Estructura frontend:** aplicación Angular standalone con rutas `/ingresar` y `/registro`.
2. **Interfaz HU-01:** formularios responsivos, validaciones, navegación entre pantallas, nivel/zona/preferencias y estados informativos de vista previa.
3. **Reutilización y UX:** aviso de formulario reusable, estilos compartidos y animaciones ligeras para aparición, selección, hover y foco. Las preferencias del sistema para movimiento reducido desactivan las animaciones.
4. **Empaquetado:** imagen Docker `padelmatch-frontend:latest`, multi-stage, que compila Angular y sirve los archivos estáticos con Nginx. `docker-compose.yml` ejecuta solo el servicio frontend en `http://localhost:8080`; Nginx devuelve la app para rutas Angular.
5. **Verificación y documentación:** pruebas unitarias, build de producción y flujo visual probados; este registro detalla límites y archivos de la entrega.

## Archivos principales

- `frontend/src/app/auth/login.page.*`: ingreso y validación del formulario.
- `frontend/src/app/auth/register.page.*`: alta visual y validaciones del perfil inicial.
- `frontend/src/app/auth/preview-notice.component.ts`: aviso compartido de vista previa.
- `frontend/src/styles.scss`: tokens visuales, estilos compartidos, responsive y animaciones accesibles.
- `frontend/public/images/`: imágenes locales provenientes de la referencia Stitch.
- `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/.dockerignore`, `docker-compose.yml`: build y distribución del frontend.
- `AGENTS.md`, `frontend/README.md`, `docs/phases/`: acuerdos de contribución, ejecución y estado de fase.

## Comandos de desarrollo

Desde la carpeta `frontend/`:

```bash
npm install --legacy-peer-deps
npm start
npm test -- --watch=false
npm run build
```

Desde la raíz del repositorio, con Docker Engine iniciado:

```bash
docker compose up --build
```

La verificación local de esta entrega cubrió `npm test -- --watch=false` y `npm run build`. Docker Desktop/Engine no estaba iniciado durante esta sesión, por lo que no se pudo construir ni iniciar el contenedor en ejecución.

## Criterios frontend cubiertos

- El ingreso valida correo y contraseña y permite alternar la visibilidad de la clave.
- El registro valida datos obligatorios, formato de correo, longitud mínima, coincidencia de contraseñas, selección de zona/nivel y compromiso de juego.
- Las animaciones no bloquean controles y respetan `prefers-reduced-motion`.
- No se envían datos ni se afirma que se creó una cuenta o sesión.
- Docker empaqueta y sirve solamente activos estáticos del frontend.

## Commit sugerido

`HU-01: dockerizar y modularizar el frontend de registro e inicio de sesión`

## HU-02 — Alta de complejos y encargados

### Frontend completado y probado

- Se agregó `/admin/complejos`, con alta, edición, baja confirmable, datos de contacto y asignación de múltiples encargados.
- La sesión del formulario de login navega a esa ruta cuando las validaciones locales pasan. Esta navegación es solo una entrada de demo: no verifica credenciales ni crea una sesión.
- `ComplexPreviewStore` administra los datos de ejemplo en memoria; al recargar se restablecen. El selector de rol simula la vista de administración/encargado y filtra los complejos asignados. No aplica seguridad real.
- Los componentes de navegación, tarjeta, formulario y diálogos son independientes para reutilización y mantenimiento.
- Stitch tiene una pantalla pública de “Clubes”, no un panel administrativo de complejos; el frontend reutiliza el sistema visual existente.
- Verificación anterior: `npm test -- --watch=false` pasó 6 pruebas; la imagen `padelmatch-frontend:latest` se reconstruyó y el contenedor quedó saludable. Las rutas `/ingresar` y `/admin/complejos` respondieron HTTP 200.
- Revisión final: `npm run build` pasó. Al repetir `npm test -- --watch=false`, Vitest falló antes de ejecutar tests al no resolver `@angular/core` desde el `init-testbed.js` generado. La llamada actual a localhost y Docker también quedó bloqueada por permisos del entorno.
- Prueba manual en navegador: login de demo → panel, alta local de un complejo y simulación del alcance de un encargado; sin errores de consola.

### Archivos principales

- `frontend/src/app/complexes/complex-admin.page.*`: coordinación del panel.
- `complex-preview.store.ts` y `complex.model.ts`: modelos y datos de demostración locales.
- `complex-form.component.*`, `complex-card.component.*`, `confirm-dialog.component.*` y `complex-admin-sidebar.component.*`: piezas reutilizables.
- `app.routes.ts` y `auth/login.page.ts`: ruta de HU-02 y continuación de demo desde el login.

### Pendiente de backend

Persistencia, endpoints, autenticación, sesión, asignación segura de encargados y autorización efectiva por complejo. El selector de rol solo sirve para probar la presentación frontend.

La HU-02 permanece en **En proceso** en Trello hasta completar backend e integración; su checklist de Frontend queda completo y el de Backend sigue pendiente.

### Commit sugerido

`HU-02: implementar administración visual de complejos y encargados`

### Ajustes visuales de login y administración

- Se quitó el texto de comunidad del login, se colocó el título junto al logo y se duplicó el tamaño del logo en escritorio; en móvil conserva una escala compacta.
- El panel ahora presenta únicamente “Complejos” en el encabezado, sin banner informativo, contador ni leyenda de alcance del encargado. El botón “Nuevo complejo” tiene menor tamaño.
- Se eliminó el rótulo “Nuevo complejo” del modal, se amplió su ancho y se compactó el formulario para que no use scroll interno. El selector de zona es personalizado, con opciones visuales propias.
- La confirmación de baja ya no muestra la explicación sobre el almacenamiento local/backend.
- Verificación: `npm run build` y la reconstrucción Docker pasaron; el contenedor `padelmatch-frontend:latest` quedó saludable. En `http://localhost:8080` se comprobó login → panel, modal y selección personalizada de zona.

### Transiciones y confirmación de guardado

- Se quitó del login el texto introductorio solicitado. Al enviar credenciales de prueba válidas, la pantalla sale con una transición lateral con perspectiva y el panel entra desde el lado opuesto; con `prefers-reduced-motion` la navegación continúa sin esperar animación.
- La apertura del formulario de complejo es más pausada. Cancelar, guardar o hacer clic fuera activa una animación de salida y mantiene el diálogo en pantalla hasta que termina.
- Se agregó `app-toast`, componente reutilizable de confirmación accesible con autocierre y botón para descartarlo. Se muestra al crear, editar o quitar un complejo en el estado local de prueba.
- La navegación de login sigue siendo exclusivamente frontend y no valida credenciales contra un servicio.
- Verificación: `npm run build` y `docker compose up --build -d frontend` completaron; el contenedor se inició con la imagen actualizada. En navegador se verificó que el login transiciona al panel, se creó un complejo temporal, el modal terminó su salida y se mostró el toast. Se recargó la página al final para descartar el dato local usado durante la prueba.
- `npm test -- --watch=false` no llegó a ejecutar casos: Vitest reportó `Timeout waiting for worker to respond` al iniciar el worker de Windows. El bundle de pruebas sí compiló. La limitación queda pendiente de resolver en el entorno de pruebas.

### Ajustes responsive y feedback de complejos

- Se redujo el tamaño del título y el logo de acceso con medidas fluidas para móvil, junto con espacios y controles más compactos; se agregó un ajuste extra para pantallas de hasta 360 px.
- El panel reduce su espacio superior, adapta la grilla de complejos al ancho disponible y ajusta barra, controles y tarjetas en móvil. El modal limita su altura al viewport, permite desplazamiento interno cuando el teléfono lo requiere y reorganiza los campos en una columna.
- La apertura del modal ahora dura 620 ms y el cierre 660 ms. El toast se monta fuera de la capa del modal y aparece después de la animación de cierre para que quede visible. El contenedor del toast respeta el ancho de pantalla y las áreas seguras del dispositivo.
- Verificación: build de Angular y rebuild de Docker correctos. En el navegador Docker a 558 × 510 px, login y panel no tuvieron desbordamiento horizontal; se verificaron el modal, la creación y actualización, y los dos mensajes de confirmación. El modal cerró tras la duración configurada y el toast se vio sobre el panel.

### HU-03 — Administración frontend de canchas

- Se agregó la ruta `/admin/complejos/:complexId/canchas` y un acceso desde cada tarjeta de complejo.
- La pantalla lista canchas por complejo, indica si son techadas o descubiertas, permite alta/edición/baja local y ofrece estados vacío y de complejo inexistente.
- Una cancha de demostración incluye reserva futura: su baja se bloquea con un aviso visible; las demás requieren confirmación antes de quitarse de la vista local.
- El formulario y las tarjetas reutilizan la paleta verde, las superficies claras y Plus Jakarta Sans del sistema visual PádelMatch tomado como referencia de Stitch. La grilla y el diálogo se adaptan a móvil; transiciones respetan `prefers-reduced-motion`.
- Archivos principales: `frontend/src/app/courts/` (modelo, store, página, tarjeta y formulario/dialog), `frontend/src/app/app.routes.ts` y la acción agregada en `complex-card.component.*`.
- Validación: `npm run build` y la reconstrucción Docker del frontend pasaron. Las 4 pruebas focalizadas del store HU-03 pasaron dentro del contenedor Node; la ejecución directa en Windows/OneDrive falla al resolver `@angular/core`. La suite completa dentro del contenedor ejecutó 9 pruebas correctas y 1 prueba preexistente de login falló porque JSDOM no implementa `window.matchMedia`. En navegador se probaron alta, edición, baja confirmada, bloqueo con reserva futura, validación requerida, estado vacío y complejo inexistente. El diálogo desmonta tras la transición o un respaldo de 220 ms para cubrir movimiento reducido.
- Responsive: la página, tarjetas y formulario tienen breakpoints móviles y soportan `prefers-reduced-motion`; la sesión de navegador disponible no expone cambio de viewport, así que la presentación móvil quedó verificada por estilos/compilación y no por captura en dispositivo emulado.
- Revisión final de accesibilidad y robustez: el diálogo ahora coloca el foco en el nombre, contiene la navegación con Tab, cierra con Escape y devuelve el foco al control que lo abrió. En ventanas bajas puede desplazarse dentro de la pantalla. Los nombres se recortan y rechazan si quedan vacíos; el mensaje de error se asocia al campo, y el envío queda bloqueado tras el primer guardado para evitar duplicados.
- Verificación final HU-03: `npm run build` en Windows y rebuild de `padelmatch-frontend:latest` en Docker completados; 6 pruebas focalizadas pasaron en Docker (4 de store y 2 de formulario). En navegador se comprobó foco inicial, navegación contenida, cierre Escape y retorno al botón de apertura.
- Alcance: solo frontend de demostración. No se agregaron endpoints, servicios ni persistencia; las reservas reales, permisos y datos quedan pendientes del backend.

### Ajustes HU-03 — 12/10/2026

- Se incorporó el sidebar compartido, se quitaron los rótulos redundantes y el contador, y se agregó una animación de entrada breve para la página.
- Cada cancha puede tener una imagen PNG/JPG/WebP (máximo 5 MB) y cuatro switches de características reutilizables. Imagen y opciones se mantienen en el store local y se muestran en la tarjeta; no se envían al servidor.
- Encabezado y tarjetas reutilizan el token oscuro `--pm-admin-surface-strong` (`#dbe7df`). Los toast compartidos pasan a verde y su animación respeta `prefers-reduced-motion`.
- Las transiciones de apertura/cierre del diálogo duran 420 ms; el cierre respeta movimiento reducido y se desmonta con un respaldo a los 460 ms.
- Bajo 480 px, el sidebar envuelve el contenido y lleva “Volver al ingreso” a una segunda fila para evitar desbordes en móviles angostos.
- Verificación: `npm run build` sin advertencias de presupuesto de estilos; 10 pruebas focalizadas HU-03 pasaron en Docker. `docker compose up --build -d frontend` reconstruyó y levantó `padelmatch-frontend:latest`; se probó en navegador el sidebar, formulario, switches, alta local y aparición del aviso. El estado temporal se limpió recargando la página.
- Alcance: frontend y datos en memoria solamente. Imagen, características, permisos y reservas reales quedan pendientes de integración con backend. El navegador disponible no permitió emular viewport móvil; se revisaron los breakpoints responsive del código.

### Ajustes visuales HU-03 — 12/10/2026

- Se unificó la superficie administrativa con un fondo gris verdoso (`--pm-admin-canvas`) y tarjetas/cabeceras blancas; el sidebar, las etiquetas y la navegación mantienen la paleta verde de marca.
- Se compactó el encabezado de Canchas, se quitó “Volver a complejos” y se agregó al sidebar navegación directa a Canchas, conservando el complejo actualmente abierto.
- Se quitaron las etiquetas de HU-02/HU-03 y el texto de opciones de ingreso próximas solicitado.
- Archivos principales: `frontend/src/styles.scss`, `frontend/src/app/complexes/complex-admin-sidebar.component.*`, `frontend/src/app/complexes/complex-admin.page.*`, `frontend/src/app/courts/court-admin.page.*`, `frontend/src/app/complexes/complex-card.component.scss` y `frontend/src/styles/_auth.scss`.
- Validación: `npm run build` pasó; las 2 pruebas focalizadas del sidebar pasaron en Docker; `docker compose up --build -d frontend` reconstruyó el contenedor. En navegador se verificaron el canvas y las tarjetas blancas en Canchas y Complejos, la cabecera de 85 px, los enlaces del sidebar y la ausencia de los textos eliminados.

### Ajustes de login, registro y administración — 12/10/2026

- HU-01: login y registro comparten el fondo administrativo. El formulario de jugador se compactó, se retiraron los textos pedidos y ahora admite varias zonas; al elegir una zona aparece el selector de nivel inicial. La selección sigue siendo local.
- HU-02: se movió la simulación de roles desde la página de Complejos al pie del sidebar, donde también se encuentra “Cerrar sesión”.
- HU-03: las tarjetas de cancha comparten una altura uniforme en la grilla.
- Se protegió el uso de `matchMedia` en login para que la transición funcione también en entornos que no implementan esa API.
- Archivos principales: `frontend/src/app/auth/register.page.*`, `login.page.ts`, `frontend/src/styles/_auth.scss`, `_register.scss`, `_motion.scss`, `frontend/src/app/complexes/complex-admin-sidebar.component.*`, `complex-admin.page.html` y `frontend/src/app/courts/court-admin.page.scss`, `court-card.component.scss`.
- Validación: build Angular y Docker completados; 21 pruebas de la suite pasaron. En navegador se probaron zonas múltiples, selector de nivel, simulación admin/encargado, cierre de sesión, fondo compartido y alturas de tarjetas. Viewport observado: 1280 × 720; no se emuló un dispositivo móvil.
- Alcance: solo frontend. Las zonas y el nivel se validan en la vista de demo; registro, sesión, permisos y persistencia reales siguen pendientes de backend.

### Ajustes de formularios y encabezado — 12/10/2026

- HU-01: se compactó el formulario de login y se redujo la altura del formulario de registro. El nivel inicial permanece visible y usa un selector nativo con estilo de marca y estados de foco/hover.
- HU-02: el encabezado de Complejos ya no muestra el avatar; el botón “Nuevo complejo” ahora comparte la fila del título. El botón “Cerrar sesión” tiene contraste y hover verdes.
- Archivos principales: `frontend/src/app/auth/register.page.html`, `frontend/src/app/auth/register.page.ts`, `frontend/src/styles/_auth.scss`, `frontend/src/styles/_register.scss`, `frontend/src/styles/_motion.scss`, `frontend/src/app/complexes/complex-admin.page.html`, `.scss` y `complex-admin-sidebar.component.scss`.
- Validación: suite completa de 23 pruebas, build Angular y Docker; verificaciones visuales manuales después del rebuild.
- Alcance: cambios solo frontend; autenticación y persistencia continúan en modo local de prueba.

## HU-05 — Grilla de turnos del complejo

### Frontend completado y probado

- Se agregó la ruta pública `/clubes/:complexId/turnos`, visible sin sesión. "Explorar turnos" del directorio de clubes ahora abre la grilla de cada club en lugar de la búsqueda de partidos.
- La grilla muestra las canchas por horario para el día elegido. Los turnos de 60 y 90 minutos se ubican según su duración, aunque cada cancha tenga horarios distintos.
- Cada turno se ve como Libre, Partido abierto, Reservado o Clase, con color, ícono y texto propios. Los partidos abiertos muestran cuántos jugadores faltan y el nivel buscado. Los turnos cerrados por el complejo en HU-04 se ven como "No disponible".
- Navegación por día con flechas y accesos a los próximos 14 días, sin poder volver antes de hoy. La fecha queda en la URL (`?fecha=AAAA-MM-DD`).
- Los turnos que ya empezaron se muestran en gris, solo con el horario, y no se pueden elegir. Hoy la grilla se ubica en la hora actual.
- Al elegir un turno libre o un partido abierto aparece un resumen con cancha, día y horario que invita a ingresar. La reserva real queda para HU-06 y la unión a partidos para HU-11.
- `SlotGridComponent` es reutilizable: la agenda del complejo (HU-07) puede pasarle su propio contenido de celda con `cellTemplate`.

### Datos de demostración

- La grilla usa los horarios y bloqueos guardados en HU-04. Si una cancha no tiene horarios guardados, usa un horario de ejemplo para que la demo no quede vacía; la pantalla de HU-04 no cambia su comportamiento.
- `BookingPreviewStore` genera reservas, partidos abiertos y clases de ejemplo de forma determinística por turno, con más reservas desde las 18:00 y más clases durante el día.
- Se sumaron como complejos de demo los tres clubes del directorio (La Cumbre Pádel, City Bell Padel Hub y Estudiantes de La Plata) con sus canchas. Se agregó "San Carlos" a las zonas del formulario de complejos, que ya existía en las zonas del backend y del registro.

### Otros cambios

- Las pantallas de administración se cargan bajo demanda. El bundle inicial bajó de 495 kB a 391 kB y la build quedó sin advertencias de presupuesto.
- `AvailabilityPreviewStore.slotsWithFallback()` agrega la consulta de turnos con horario de ejemplo sin modificar los métodos existentes.

### Archivos principales

- `frontend/src/app/slot-grid/`: página, grilla, selector de día, leyenda, resumen, armado de la grilla, horario de ejemplo y servicio de datos.
- `frontend/src/app/bookings/`: modelo de reserva y reservas de demostración.
- `frontend/src/app/shared/local-date.ts`: utilidades de fecha y hora local.
- `frontend/src/styles/_slot-states.scss`: colores de estado compartidos.
- `frontend/src/app/app.routes.ts`, `landing/club-directory.page.html`, `landing/landing.data.ts`, `complexes/complex-preview.store.ts`, `courts/court-preview.store.ts`, `complexes/complex-form.component.ts` y `availability/availability-preview.store.ts`.
- `docs/contracts/hu-05-grilla-de-turnos.md` y `docs/phases/phase-07-slot-grid.md`.

### Validación

- `npm run build`: aprobado sin advertencias.
- `npm test -- --watch=false`: 85 pruebas aprobadas (24 nuevas de HU-05). Fallan 3 pruebas de HU-04 que ya fallaban antes de este cambio, porque esperan textos y estructura anteriores: `availability-calendar.component.spec.ts` (2) y `court-availability.page.spec.ts` (selector de rol del sidebar).
- Se actualizaron dos pruebas existentes por el cambio de comportamiento: el enlace "Explorar turnos" del directorio y la cantidad de complejos de demo (de 2 a 5).
- Recorrido en Chromium a 1280 × 860 y 390 × 844: directorio → Explorar turnos → día siguiente → partido abierto → resumen → cierre con Escape, sin errores de consola.

### Pendiente de backend

`GET /api/v1/complexes/{complexId}/slots?date=AAAA-MM-DD`, según el contrato propuesto. Al integrarlo, solo cambia `SlotGridService.dayGrid()`.

### Commit sugerido

`HU-05: implementar grilla de turnos del complejo en el frontend`
## HU-01 backend y PostgreSQL

- Se incorporó la API Go de registro, inicio de sesión y consulta de la sesión (`/api/v1/auth/register`, `/api/v1/auth/login` y `/api/v1/auth/me`), con contraseñas bcrypt y tokens JWT.
- El registro valida y normaliza los datos, y guarda el usuario y su perfil inicial en PostgreSQL dentro de una transacción.
- La migración inicial está en `backend/migrations/001_auth.sql`; no crea tablas `zones` ni `user_zones`.
- Se requieren `DATABASE_URL` y `JWT_SECRET` (mínimo 32 bytes); `PORT` es opcional y usa `8000` por defecto.
- Alcance: backend implementado. Las pantallas Angular de HU-01 siguen en modo de demostración local y todavía no consumen estos endpoints; no se afirma integración de extremo a extremo.

## Verificación de integración HU-01 — 22/10/2026

- Backend: `go test -count=1 ./...` pasó; `internal/auth` pasó y los demás paquetes no tienen tests directos.
- Frontend: `npm run build` pasó. La suite `npm test -- --watch=false` terminó con 61 pruebas correctas y 3 fallidas (14 archivos de prueba).
- Fallas HU-04 para revisión del equipo frontend:
  - `availability-calendar.component.spec.ts` — `renders each received date and omits a turn counter`: no encontró `.day-heading h3`.
  - `availability-calendar.component.spec.ts` — `shows an explicit empty state when no turns are generated`: esperaba `No hay turnos para mostrar`, pero la vista mostró `Sin turnos para esta fecha`.
  - `court-availability.page.spec.ts` — `offers a designed keyboard-accessible court picker with the selected court marked`: esperaba que no hubiera un `<select>`, pero encontró `select#demo-role`.
- El árbol `frontend/` coincide con `origin/Desarrollo`; estos fallos están en el frontend recibido y no fueron causados por la resolución documental. No se modificaron tests ni componentes HU-04.

## HU-02 backend — integración para revisión — 22/10/2026

- Se integró en la rama de HU-02 el backend de autenticación HU-01 y el frontend actualizado de Desarrollo, conservando la API de complejos y encargados y la migración `backend/migrations/002_complexes.sql`.
- HU-02 implementa persistencia PostgreSQL y autorización por rol/asignación. Las pantallas Angular de complejos siguen usando datos locales y todavía no consumen esos endpoints; la integración de extremo a extremo queda pendiente.
- Backend: `go test -count=1 ./...` pasó. La prueba de migración PostgreSQL se omitió porque no hay `TEST_DATABASE_URL` configurada; no se usó el contenedor local ya que no se confirmó que fuera una base desechable.
- Frontend: `npm run build` pasó. La suite obtuvo 61 pruebas correctas y los mismos 3 fallos HU-04 documentados arriba. No se modificaron componentes ni pruebas Angular.

## HU-03 canchas

- Se agregó el CRUD de canchas por complejo en Go. Solo ADMIN y encargados asignados al complejo activo pueden consultar o modificar sus canchas; los complejos dados de baja no son accesibles.
- La migración `003_courts.sql` agrega canchas con baja lógica, características booleanas y claves foráneas restrictivas. La imagen opcional acepta PNG, JPEG o WebP decodificable, con límite de 5 MiB y dimensiones acotadas.
- La baja se rechaza con `503` porque todavía no hay una fuente real de reservas para comprobar turnos futuros de forma segura. El punto de extensión revisa reservas dentro de la misma transacción que marca la cancha como inactiva.
- Verificación: `go test ./...` pasó. La prueba PostgreSQL de HU-03 es optativa y se omite si `TEST_DATABASE_URL` no está configurada.
- Integración HU-03 — 22/10/2026: `go test -count=1 ./...` y `npm run build` pasaron. La suite Angular reportó 61 pruebas correctas y los 3 fallos HU-04 ya documentados; no se cambiaron componentes ni pruebas frontend. No se ejecutaron pruebas contra PostgreSQL porque no hay `TEST_DATABASE_URL` para una base desechable.
- Estado: la API de canchas está implementada, pero la baja devuelve HTTP 503 hasta integrar reservas reales. El criterio de baja con reservas sigue pendiente y HU-03 no se considera completamente finalizada.

## Integración Angular de HU-01 — 29/10/2026

- Se conectaron el registro y el login Angular con `POST /api/v1/auth/register` y `POST /api/v1/auth/login`; se agregaron DTOs, servicio de sesión, almacenamiento de JWT, interceptor Bearer, restauración con `GET /api/v1/auth/me` y guard de autenticación. Los flujos exitosos navegan al inicio; no se concede rol por selección visual.
- El registro Angular usa una zona requerida y envía el DTO exacto; `confirmPassword` se usa solo en validación local. La autorización para adaptar el control permite esta implementación, pero la aprobación formal del equipo aún debe documentarse y el criterio permanece abierto.
- Proxy de desarrollo `/api` y proxy Nginx al servicio Compose `backend:8000` configurados. JWT del backend vence en 24 horas; no hay renovación y el almacenamiento web no protege frente a XSS.
- Evidencia real en Docker Compose aislado con PostgreSQL 17: registro 201, login, lectura autenticada de `/me`, rechazo de `/me` sin token (401) y frontend Nginx 200. No se usó ninguna base o volumen previo.
- Verificaciones actuales: `go test -count=1 ./...` con `TEST_DATABASE_URL` en PostgreSQL 17 y `go vet ./...` pasaron; `npm run build` pasó; la suite Angular tuvo 108 pruebas aprobadas y las mismas 3 fallas HU-04 observadas también en un worktree limpio de `origin/Desarrollo`; `git diff --check` pasó.
- La prueba visual en navegador sigue pendiente porque la automatización no pudo determinar con seguridad la URL activa de Chrome. La integración HTTP real de registro y login sí se validó mediante Nginx, Go y PostgreSQL 17 descartable; HTTP 201/409/401, `/me` autenticado y no autenticado, y persistencia SQL fueron comprobados.
