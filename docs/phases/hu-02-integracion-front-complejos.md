# HU-02 · Integración frontend de complejos

## Fases realizadas

1. Se revisaron la tarjeta HU-02 de Trello, las rutas HTTP disponibles y los componentes de administración existentes.
2. Se agregó un servicio Angular tipado para listar, crear, actualizar, dar de baja complejos y obtener encargados desde la API.
3. Se conectó la pantalla existente con autenticación y respuestas reales; se incorporaron carga, error, reintento y estado vacío.
4. Se adecuaron los permisos visibles: administración puede crear, asignar encargados y dar de baja; un encargado edita los datos de sus complejos y conserva las asignaciones actuales.
5. El login consulta el acceso a complejos: administración y encargados van al panel; las cuentas de jugador vuelven al inicio.

## Archivos principales

- `frontend/src/app/complexes/complex-api.service.ts`: cliente HTTP y validación de respuestas.
- `frontend/src/app/complexes/complex-admin.page.ts` y `.html`: carga y operaciones con permisos de la API.
- `frontend/src/app/complexes/complex-form.component.*`: edición restringida de encargados para cuentas de gestión.
- `frontend/src/app/complexes/complex-card.component.*`: detalle y acciones disponibles por permiso.
- `frontend/src/app/complexes/complex.model.ts`: modelos de complejos y encargados.
- `frontend/src/app/auth/login.page.ts`: destino de inicio según acceso autorizado.

## Validaciones

- La autenticación reutiliza el interceptor JWT que ya existía.
- La interfaz diferencia errores de autorización y errores de conexión; los cambios se muestran solo después de una respuesta exitosa del servidor.
- El build de Angular dentro de Docker terminó correctamente. `GET /` respondió `200` y el endpoint de complejos respondió `401` sin sesión, confirmando que requiere JWT.
- Las pruebas de login y rutas pasaron. La suite completa dejó 3 fallas preexistentes en pruebas de disponibilidad HU-04 (`availability-calendar.component.spec.ts` y `court-availability.page.spec.ts`); 120 pruebas pasaron.

## Límites

- No se modificó backend, base de datos, endpoints ni infraestructura.
- El backend crea las cuentas como `USER`; para probar administración se necesita una cuenta `ADMIN` preparada por el equipo backend conforme a su guía.
- La disponibilidad de encargados es exclusiva de administración. Para un encargado, los datos ya asignados se conservan al editar.
