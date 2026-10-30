---
id: "0011"
estado: Aprobado
version: 1
fecha: "2026-10-29"
titulo: "Baja de cancha con protección de reservas"
hu: HU-03
capa: backend
---

# TDD-0011: Baja de cancha con protección de reservas

> TDD v1 aprobado por el usuario en la conversación del 29/10/2026. Describe solo la baja de cancha; no acredita implementación ni pruebas de esta protección.

## Contexto de Negocio (PRD)

### Objetivo
Permitir la baja lógica de una cancha sin alterar reservas vigentes futuras o en curso ni dar de baja una cancha que tenga alguna de ellas.

### User Persona
- **Rol:** encargado asignado al complejo o administrador general.
- **Necesidad:** retirar una cancha sin afectar compromisos existentes.

### Criterios de Aceptación
- **CA-01:** conservar los permisos y validaciones existentes para la cancha y su complejo.
- **CA-02:** dar de baja lógicamente la cancha si no tiene reservas `reserved` futuras ni en curso. Las reservas finalizadas o canceladas no impiden la baja y no se modifican.
- **CA-03:** rechazar la baja si existe alguna reserva `reserved` futura o en curso para esa cancha; mantener cancha y reservas sin cambios.
- **CA-04:** ante un error al consultar reservas, no dar de baja la cancha ni tratar el error como ausencia de reservas.
- **CA-05:** coordinar la baja y la creación concurrente de reservas para que no quede una reserva vigente en una cancha dada de baja.

Una reserva en curso comenzó y aún no terminó. Su inclusión es una decisión del usuario del 29/10/2026, adicional a las referencias históricas a reservas futuras.

## Diseño Técnico (RFC)

### Modelo de Datos
Reutilizar `courts.deleted_at` y `reservations` (`court_id`, `status`, `starts_at`, `ends_at`). Una reserva protegida tiene `status = 'reserved'` y `ends_at` posterior al instante de comprobación; una reserva que terminó exactamente en ese instante no bloquea. No se agregan tablas ni migraciones.

La autorización, el bloqueo `FOR UPDATE` de la cancha, la consulta de reservas y la baja lógica se realizan en la misma transacción. La creación de reservas toma el mismo bloqueo; un error provoca rollback.

### Contrato de API
- **Endpoint:** `DELETE /api/v1/complexes/{complexId}/courts/{courtId}`.
- **Request:** JWT; IDs UUID; sin cuerpo.
- **Response:** `204 No Content`, sin cuerpo.
- **Error:** JSON `{"error":"mensaje"}`. Se conservan códigos y mensajes existentes, incluido el mensaje histórico de reservas futuras para el `409`.

### Componentes del Monolito Modular
- **Modelo:** identificar reservas protegidas sin modificar su estado.
- **Servicio HTTP:** conservar autenticación, permisos y traducción de errores existentes.
- **Repositorio:** consultar `reservations` mediante el verificador dentro de la transacción que bloquea la cancha; conservar rollback ante error.

## Casos de Borde y Errores
| Escenario | Resultado esperado | HTTP |
| --- | --- | --- |
| Sin reservas protegidas | Baja lógica, sin modificar reservas | 204 |
| Reserva `reserved` futura o en curso de la cancha | Mantener cancha y reservas | 409 |
| Reserva cancelada, finalizada o de otra cancha | No impide la baja | 204 |
| ID inválido / sin autenticación / sin permiso | Sin cambios | 400 / 401 / 403 |
| Complejo o cancha inexistente o inactivo | Sin cambios | 404 |
| Fuente no disponible / otro error de persistencia | Sin baja ni éxito ficticio | 503 / 500 |

## Plan de Implementación
1. Aprobación humana del TDD v1 registrada el 29/10/2026.
2. Red → Green de las reglas y del contrato HTTP, incluyendo permisos y errores.
3. Verificar en PostgreSQL descartable la baja, aislamiento por cancha, rollback y carreras entre reserva y baja.
4. Ejecutar las verificaciones backend y registrar resultados y omisiones. Disponibilidad, cancelaciones, frontend y Docker quedan fuera.
