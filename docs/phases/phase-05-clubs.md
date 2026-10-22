# Fase 05 — Complejos y canchas

## Objetivo

Administración de complejos y encargados (HU-02); gestión de canchas (HU-03).

## Historias de usuario relacionadas

HU-02 / HU-03

## Funcionalidades

CRUD de complejos, asignación de encargados y CRUD de canchas con control de acceso por complejo.

## Backend

HU-02 implementa la API de complejos en `backend/internal/complexes/`: administración autenticada, alta y edición, baja lógica y asignación de encargados. ADMIN puede administrar complejos; los encargados consultan y actualizan únicamente los complejos asignados, sin cambiar esa asignación. El backend de canchas HU-03 se gestiona en su rama/PR y no forma parte de esta integración.

## Frontend

Listado, tarjetas y formularios para alta/edición/baja de complejos, asignación visual de encargados y gestión local de canchas por complejo. HU-03 permite indicar nombre o número, elegir techada/descubierta y muestra el bloqueo de baja cuando una cancha demo tiene reservas futuras.

## Base de datos

HU-02 agrega `users.role`, `complexes` y `complex_managers` mediante `backend/migrations/002_complexes.sql`. No agrega seeds de complejos. La tabla `courts` corresponde a HU-03 y no se incorpora en esta integración.

## Caché

Sin cambios.

## Archivos a crear o modificar

- `backend/internal/complexes/`, `backend/internal/auth/`, `backend/internal/database/` y `backend/migrations/002_complexes.sql`.
- Vistas y formularios admin para complejos, encargados y canchas.
- Documentación: `docs/phases/phase-05-clubs.md`, `docs/phases/README.md`, `docs/CHANGELOG-DEVELOPMENT.md`.

## Criterios de aceptación

Con JWT, ADMIN puede listar, crear, editar y dar de baja complejos y asignar encargados. Un encargado solo puede listar y actualizar los complejos asignados y no puede alterar su asignación. HU-03 mantiene sus propios criterios para canchas y reservas.

## Cómo verificar la fase

Ejecutar `go test -count=1 ./...` desde `backend/`. Las pruebas de persistencia de `internal/database` requieren `TEST_DATABASE_URL` apuntando a una base desechable. Verificar la interfaz Angular por separado: en esta integración sigue usando stores locales y no consume la API de complejos.

## Estado

HU-02: backend implementado en Go con persistencia PostgreSQL, autorización por rol/asignación y baja lógica. El frontend de complejos sigue en modo de demostración local y aún no consume estos endpoints; la integración Angular/backend queda pendiente. HU-03 frontend continúa siendo una demostración local; su backend se revisa en el PR separado de canchas.

## Límite de HU-03 frontend

La lista y las operaciones de canchas se mantienen en un store Angular local para permitir pruebas manuales sin servidor. La cancha con reserva futura es un dato de demostración; no representa una consulta real de turnos. La autorización del encargado, la persistencia y el rechazo definitivo de bajas deben validarse al integrar backend.

## Ajustes visuales HU-03 — 12/10/2026

- La administración de canchas reutiliza el sidebar de complejos y elimina rótulos redundantes y el contador.
- Las tarjetas aceptan una imagen PNG, JPG o WebP de hasta 5 MB y muestran cuatro características configurables: iluminación, tablero electrónico, Wi-Fi y superficie acrílica. El store local conserva imagen y opciones durante la sesión; no se suben ni persisten.
- Encabezado y tarjetas usan `--pm-admin-surface-strong` (`#dbe7df`). Los avisos compartidos usan fondo verde con texto blanco.
- La entrada de la página y las transiciones del diálogo duran aproximadamente 420 ms; el desmontaje espera 460 ms y `prefers-reduced-motion` elimina las animaciones.
- Bajo 480 px el sidebar ajusta sus elementos en dos filas para evitar desbordamiento horizontal.
- Archivos principales: `frontend/src/app/courts/court-admin.page.*`, `court-form*`, `court-card*`, `court-preview.store.ts`, `frontend/src/app/shared/toast.component.scss` y `frontend/src/styles.scss`.
- Verificación: build Angular, 10 pruebas HU-03, rebuild del servicio Docker frontend e interacción en navegador (sidebar, modal, características, alta local y aviso). No se emuló viewport móvil en el navegador disponible; breakpoints responsive quedan definidos en SCSS y revisados para anchos de 320–375 px.

## Ajustes visuales HU-03 — 12/10/2026

- El área administrativa comparte un canvas gris verdoso (`--pm-admin-canvas`) con tarjetas y cabeceras blancas; los tonos de navegación, resaltados y etiquetas usan la paleta verde común.
- Canchas usa un encabezado más bajo. Se retiró el regreso redundante a complejos y el sidebar ofrece enlaces a Complejos y Canchas; desde Canchas el enlace conserva el identificador del complejo seleccionado.
- Se quitaron las etiquetas de historia en los pies de página y el aviso de opciones de ingreso futuras.
- Archivos: `frontend/src/styles.scss`, `frontend/src/app/complexes/complex-admin-sidebar.component.*`, `frontend/src/app/complexes/complex-admin.page.*`, `frontend/src/app/courts/court-admin.page.*`, `frontend/src/app/complexes/complex-card.component.scss` y `frontend/src/styles/_auth.scss`.
- Validación: `npm run build` pasó; las 2 pruebas del sidebar pasaron en Docker; el contenedor frontend se reconstruyó. En navegador se comprobaron los colores y cabecera compacta en Canchas, la paleta en Complejos, los enlaces del sidebar y la ausencia de las etiquetas/textos retirados.

## Ajustes de navegación HU-02 y tarjetas HU-03 — 12/10/2026

- La simulación de vista de administración/encargado quedó en la parte inferior del sidebar, y desde el mismo panel se navega con “Cerrar sesión”. La página de Complejos ya no muestra su tarjeta de simulación dentro del contenido.
- Las tarjetas de canchas mantienen el mismo alto dentro de la grilla, aunque varíe la cantidad de características o haya una nota de reserva.
- Archivos principales: `frontend/src/app/complexes/complex-admin-sidebar.component.*`, `complex-admin.page.html`, `frontend/src/app/courts/court-admin.page.scss` y `court-card.component.scss`.
- Validación: las pruebas completas de frontend pasaron; en navegador se cambió a Encargado y se volvió a Administración, y se compararon las alturas renderizadas de las tarjetas (365 px cada una).
- El selector de simulación también se muestra en el sidebar de Canchas y permite elegir el rol y el encargado de prueba desde esa pantalla.

## Ajustes de administración — 12/10/2026

- El botón “Nuevo complejo” quedó junto al título en la cabecera y se quitó el avatar de usuario.
- “Cerrar sesión” tiene un estado verde visible, un hover de mayor contraste y foco accesible.
- Validación: suite completa de 23 pruebas y revisión manual posterior al rebuild Docker.

Para HU-02, la interfaz de complejos todavía necesita conectarse a la API y reemplazar sus datos locales. La interfaz HU-03 también sigue en memoria; aunque el backend de canchas define su contrato en la rama/PR correspondiente, la validación de bajas depende de integrar una fuente real de reservas.
