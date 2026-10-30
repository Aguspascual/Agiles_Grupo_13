---
id: "0002"
estado: Aprobado
version: 1
autor: "Pedro Moyano Amaya"
fecha: "2026-10-22"
titulo: "Baja de horario diario recurrente"
hu: HU-04
capa: backend
trello: "https://trello.com/c/PfnE8VXU"
---

# TDD-0002: Baja de horario diario recurrente

> Contrato v1 aprobado explícitamente en la conversación del 27/10/2026. Las comprobaciones con reservas reales siguen pendientes.

> **Adenda aprobada por el usuario el 29/10/2026:** además de las reservas futuras previstas por RN-15, se protegen las reservas `reserved` en curso (ya comenzaron y aún no terminaron). Las finalizadas y canceladas no bloquean. Esta decisión nueva no modifica la redacción histórica de RN-15.


## Contexto de Negocio (PRD)

### Objetivo
Quitar la configuración recurrente de un día sin reservas futuras vigentes, sin borrar los demás ni cancelar o reprogramar reservas unilateralmente ([RN-06, RN-09, RN-10 y RN-15](../../REGLAS-NEGOCIO.md)). No es cancelar una reserva ni bloquear una fecha puntual.

### User Persona
- **Nombre / rol:** encargado de un complejo.
- **Necesidad:** dejar de ofrecer el horario configurado para un día de la semana, preservando compromisos existentes.

### Criterios de Aceptación
- **CA-01:** permitir la baja al encargado asignado al complejo de la cancha y al administrador general (RN-12), sobre cancha y complejo activos. Denegar a otros roles o encargados ajenos.
- **CA-02:** quitar el día y sus franjas atómicamente; no cambiar los otros días ni borrar reservas.
- **CA-03:** si hay reservas futuras vigentes para ese día de la semana y cancha, rechazar íntegramente la baja y mantener la configuración, incluso si está deshabilitada (RN-15). Se puede deshabilitar sin cancelar reservas. No solicitar consentimientos desde este endpoint.
- **CA-04:** rechazar una revisión desactualizada sin borrar cambios ajenos. Repetir una baja no modifica otros recursos.
- **CA-05:** eliminar la configuración implica cargarla mediante una nueva alta para recuperarla; deshabilitar, en cambio, conserva franjas y duración y permite mantener las reservas futuras sin aceptar nuevas (RN-13). Se propone que un día sin configuración no genere nuevos turnos.

## Diseño Técnico (RFC)

### Modelo de Datos
Reutilizar el [modelo del alta](TDD-0001-hu-04-alta-horario-diario.md#modelo-de-datos). Baja física de la configuración y sus franjas (RN-13), nunca de reservas. Deshabilitar es una modificación, no una eliminación.

Comparar revisión, comprobar ausencia de reservas futuras vigentes de esa cancha y día de la semana, y eliminar dentro de una transacción. Coordinar la exclusión con altas de reservas concurrentes; una comprobación previa fuera de esa protección no alcanza. Sin comprobación con reservas reales, CA-03 no puede declararse verificado ni suplirse por éxito ficticio.

La conexión acordada consulta `reservations` con `status = 'reserved'` y `ends_at` posterior al instante de comprobación, en la misma transacción y con el mismo bloqueo `FOR UPDATE` de cancha que usa HU-06. Se calcula el día de la reserva en `America/Argentina/Buenos_Aires`. Un error de consulta no equivale a ausencia de reservas. El comportamiento sigue pendiente de implementación y verificación real.

### Contrato de API
- **Endpoint:** `DELETE /api/v1/complexes/{complexId}/courts/{courtId}/weekly-schedule/days/{weekday}`.
- **Request Body:** ninguno. `weekday` es `1..7`.
- **Headers:** JWT e `If-Match: "<revision>"`, obtenida en la última búsqueda/alta/modificación del día.
- **Response:** `204 No Content`, sin cuerpo.
- Autenticación, errores JSON y revisión: [contrato común](README.md#hu-04-acuerdos-y-contrato-común-aprobado).

### Componentes del Monolito Modular
- **Modelo:** identificar día y reglas que impiden su baja.
- **Servicio HTTP:** autorización y traducción de inexistencia, conflictos y revisión desactualizada.
- **Repositorio:** eliminación condicionada por revisión y protección de reservas, con rollback completo.

## Casos de Borde y Errores
| Escenario | Resultado esperado | HTTP |
| --- | --- | --- |
| Día inexistente o ya eliminado | Sin cambios | 404 |
| Reservas futuras vigentes, con día habilitado o deshabilitado | Rechazar la baja; mantener configuración y reservas intactas (RN-15) | 409 |
| Falta revisión / revisión desactualizada | No eliminar | 428 / 412 |
| Parámetros o revisión mal formados | Rechazo sin cambios | 400 |
| Sin JWT / sin permiso / recurso inexistente | Según contrato común | 401 / 403 / 404 |
| Falla de persistencia | Mantener día y franjas | 500 |

## Plan de Implementación
1. Revisar y aprobar criterios, modelo y contrato del TDD; reglas de baja, permisos y diferencia entre baja/deshabilitado ya están acordadas.
2. Red → Green HTTP de CA-01/04; comprobar que un rechazo no elimina nada.
3. Red → Green PostgreSQL real de CA-02/03/05: rollback, rechazo con reservas futuras tanto habilitado como deshabilitado, baja sin reservas seguida de nueva alta y carrera entre reservar y eliminar el día. Verificar la ausencia de nuevos turnos con la consulta de disponibilidad cuando exista.
4. Refactor y evidencia en PR por criterio. Los ciclos ejecutados y los límites de implementación están registrados en la documentación backend vinculada.
