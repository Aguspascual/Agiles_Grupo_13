# Fase 05 — Complejos y canchas

## Objetivo

Administración de complejos y encargados (HU-02); gestión de canchas (HU-03).

## Historias de usuario relacionadas

HU-02 / HU-03

## Funcionalidades

CRUD de complejos, asignación de encargados y CRUD de canchas con control de acceso por complejo.

## Backend

`backend/internal/clubs/`.

## Frontend

Listado, tarjetas y formularios para alta/edición/baja de complejos, asignación visual de encargados y gestión local de canchas por complejo. HU-03 permite indicar nombre o número, elegir techada/descubierta y muestra el bloqueo de baja cuando una cancha demo tiene reservas futuras.

## Base de datos

Tablas de complejos, encargados y canchas con seeds de La Plata.

## Caché

Sin cambios.

## Archivos a crear o modificar

- `backend/internal/clubs/`.
- Vistas y formularios admin para complejos, encargados y canchas.
- Documentación: `docs/phases/phase-05-clubs.md`, `docs/phases/README.md`, `docs/CHANGELOG-DEVELOPMENT.md`.

## Criterios de aceptación

El administrador puede crear, editar y dar de baja complejos y asignar encargados. Un encargado solo puede gestionar sus complejos. La baja de canchas con reservas futuras se rechaza.

## Cómo verificar la fase

Probar CRUD y permisos con/sin usuario encargado, además de reglas de baja de canchas.

## Estado

PARCIAL — frontend de HU-02 y HU-03 implementado en modo de demostración local. Backend, persistencia y validación real de reservas quedan pendientes.

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

La integración con backend debe definir el contrato para cargar y persistir imágenes y características; esta entrega solo prepara la presentación frontend y sus datos locales.
