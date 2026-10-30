# HU-08 — Integración frontend con backend

## Fases

1. **Contrato:** consumir `PUT /api/v1/auth/me` con `name`, `zone`, `level`, `position` y `hand`; actualizar `GET /me`/estado de sesión con la respuesta.
2. **Pantalla:** cargar los valores autenticados, permitir editar los campos persistidos, validar errores y proteger `/perfil`.
3. **Presentación:** mostrar nivel del usuario autenticado en Home y tarjetas; retirar los datos locales de demostración como fuente del perfil.
4. **Navegación:** al iniciar sesión, verificar el permiso administrativo con `GET /api/v1/complexes/available-managers`; los jugadores sin ese permiso ingresan al inicio.
5. **Verificación:** pruebas de servicio/sesión, build Angular, smoke test HTTP y recreación del stack Docker.

## Archivos principales

- `frontend/src/app/auth/`: modelo, API y sesión autenticada.
- `frontend/src/app/profile/`: formulario de edición conectado al perfil real.
- `frontend/src/app/landing/`: presentación del nivel guardado.

## Límites

Solo frontend. Teléfono, apodo, estilo de juego, foto y privacidad no están en el contrato actual; no se enviarán ni se afirmará que persisten. El correo se mantiene de solo lectura. El backend acepta una zona y los catálogos indicados en `docs/backend/TDDs/TDD-0005-hu-08-modificacion-perfil-propio.md`.

## Validaciones

- Pruebas focalizadas de autenticación/perfil: **17/17 aprobadas**.
- Suite frontend: **133 aprobadas; 3 fallidas** en pruebas existentes de HU-04 (`availability-calendar` y selector demo de canchas), fuera de los archivos de HU-08.
- `npm run build`: aprobado; permanece el warning existente de 29 bytes sobre el presupuesto SCSS en `complex-form.component.scss`.
- API Docker: registro, `PUT /api/v1/auth/me`, lectura `GET /api/v1/auth/me` y limpieza de la cuenta temporal, aprobados.
- Navegador Playwright CLI: `/perfil` renderizó con sesión válida en escritorio y móvil; consola sin errores ni warnings en esa pasada. La captura móvil mostró el correo largo recortado y se añadió `text-overflow: ellipsis`; la segunda apertura del navegador falló por un cierre de Chromium/crashpad, así que ese ajuste final quedó confirmado por build, no por nueva captura.
- `go test` y `go vet` no disponibles en el host porque Go no está instalado; el backend no se modificó.
- `git diff --check`: aprobado.
