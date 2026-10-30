# Mejora: ajustes visuales de login y registro

Rama: `mejora/frontend-ajustes-visuales`. Alcance: solo frontend.

## Fases

1. **Login compacto.** Tarjeta, campos y panel derecho más chicos; tercera tarjeta informativa; "¿Olvidaste tu contraseña?" debajo del campo; botones de Google y Apple con colores de marca.
2. **Resolución 800x600 (proyector).** Login y registro en dos columnas compactas entre 681px y 1030px de ancho; una columna por debajo de 680px.
3. **Autocompletado legible.** Texto oscuro y `color-scheme: light` para que el navegador no pinte texto claro sobre el fondo del campo.
4. **Registro.** Más espacio entre secciones, tarjeta lateral sin estirarse, desplegable de nivel propio (accesible por teclado), zona habitual con selección múltiple (mínimo una), posición y mano hábil obligatorias y en grupos separados.
5. **Mensajes de error.** Errores de campo en una sola línea y letra chica; aviso claro si el correo ya existe; desplazamiento hasta el primer error.
6. **Flujo de alta.** Al registrarse se muestra un aviso (toast) y se lleva a `/ingresar` sin iniciar sesión.
7. **Panel admin de complejos.** Sidebar siempre visible (188px entre 561px y 1000px; barra superior solo en celulares de 560px o menos) en las cuatro pantallas admin; encabezado con eyebrow, subtítulo y contador; tarjetas compactas con foto a la izquierda y acciones en grilla uniforme (acción principal destacada).
8. **Agenda a 800x600.** Se corrige el desborde horizontal de la tira de días.
9. **Tarjetas de complejo y vista completa.** El encabezado queda solo con el título. Cada tarjeta muestra la imagen en grande y el nombre; al presionarla se abre la vista completa del complejo (/admin/complejos/:complexId): portada con imagen, datos, **Editar datos**, **Eliminar complejo** (solo administradores), listado de canchas con **Horarios** y **Cerrar cancha** (baja con confirmación; el servicio rechaza el cierre si hay reservas futuras) y la agenda del día con turnos libres, reservados y quién reservó.
10. **Ajustes de la vista del complejo.** Cambiar de día recarga solo la grilla (se atenúa mientras carga, sin reiniciar la pantalla); los datos del complejo van en una tarjeta desplegable; los modales vuelven a centrarse en toda la pantalla (la animación de entrada de las pantallas admin dejaba un 	ransform activo que cambiaba el bloque contenedor de los modales ixed); la tarjeta Canchas tiene un selector de cancha, la grilla muestra solo los turnos de la cancha elegida y **Administrar horarios** abre un modal con el editor semanal.
11. **Tarjeta Canchas simplificada.** Selector propio (pp-select-menu, reutilizable) con la última opción **Crear cancha** (abre el formulario de alta y deja la nueva cancha seleccionada); **Administrar horarios** queda a la derecha del selector; se quitan la etiqueta de tipo y el botón Cerrar cancha (el cierre sigue disponible en Administrar canchas). El modal de horarios no tiene subtítulo ni tarjeta desplegable y sus íconos de reloj son negros.

## Archivos principales

- `frontend/src/styles/_auth.scss`, `frontend/src/styles/_register.scss`
- `frontend/src/app/auth/login.page.{ts,html}`, `frontend/src/app/auth/register.page.{ts,html}`
- `frontend/src/app/auth/auth-flash.store.ts` (aviso de una sola lectura entre páginas)
- `frontend/src/app/complexes/complex-admin.page.{html,scss}`, `complex-admin-sidebar.component.scss`, `complex-card.component.scss`, y breakpoints en `agenda`, `availability` y `courts`
- `frontend/src/app/complexes/complex-overview.component.*` (cabecera de la vista completa) y `complex-card.component.*` (tarjeta con imagen y nombre)
- `frontend/src/app/agenda/agenda.page.*` y `app.routes.ts` (ruta con `data.overview`)
- `frontend/src/app/availability/court-schedule-dialog.component.*` y `schedule-utils.ts` (modal de horarios y utilidades compartidas con la página de disponibilidad)
- `frontend/src/app/shared/select-menu.component.*` (selector con el estilo de la app)
- Tests: `login.page.spec.ts`, `register.page.spec.ts`

## Validaciones

- `ng test` sobre `src/app/auth/**`: 35 tests en verde.
- Revisión visual en Chrome a 800x600 y con clics reales.
- Todas las animaciones respetan `prefers-reduced-motion`.

## Límites de alcance

- `app.spec.ts` y `landing.page.spec.ts` ya fallaban en la base de la rama (`55a72b8`) por peticiones sin simular; no se tocaron.
- La imagen del complejo (campo `imageDataUrl`) proviene de un trabajo aparte de backend y formulario; la tarjeta y el modal la usan y muestran un ícono si no existe.
- No se modificó backend, base de datos ni infraestructura.
- **Zona habitual múltiple:** el servicio actual guarda una sola zona por jugador. El frontend permite elegir varias, pero envía solo la primera como zona principal. Guardar todas requiere un cambio de contrato en el backend.
- El correo repetido se detecta al enviar el formulario, no mientras se escribe, porque no existe un endpoint de consulta.
