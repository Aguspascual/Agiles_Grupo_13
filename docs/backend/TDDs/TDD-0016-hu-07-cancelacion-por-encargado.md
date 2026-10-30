---
id: "0016"
estado: "Borrador v1 para aprobación humana; la aprobación ocurre en la revisión de la PR"
version: 1
autor: "Equipo backend"
fecha: "2026-10-30"
titulo: "Cancelación de una reserva por el encargado"
hu: HU-07
capa: backend
---

# TDD-0016: Cancelación de una reserva por el encargado

## Contexto de Negocio (PRD)

### Objetivo
Permitir que el encargado del complejo (o el administrador general) cancele desde la
agenda una reserva vigente, web o manual, liberando el turno y avisando al jugador cuando
la reserva tiene organizador. Comparte el núcleo transaccional con
[TDD-0010](TDD-0010-hu-14-cancelacion-reserva.md) (cancelación por el jugador).

### User Persona
*   **Nombre**: Encargado del complejo / administrador general.
*   **Necesidad**: liberar un turno cuando el cliente no podrá asistir, sin el límite de
    cuatro horas que rige para el jugador, y que el jugador quede avisado.

### Criterios de Aceptación
*   **CA-01 — Actor**: administrador general o encargado asignado al complejo, validado
    dentro de la transacción (`authorizeManual`, igual que TDD-0012). Un actor ajeno recibe
    `403` antes de saber si el complejo existe.
*   **CA-02 — Sin límite de 4 h**: se puede cancelar cualquier reserva `reserved` que aún no
    terminó (`ends_at > now`, reloj del servidor, RN-07). Si `ends_at <= now` responde
    `409 la reserva ya finalizó`.
*   **CA-03 — Idempotencia**: una reserva ya `cancelled` responde `200` sin escrituras.
*   **CA-04 — Pertenencia**: reserva inexistente o de otro complejo responde `404`.
*   **CA-05 — Orígenes**: aplica a `origin='web'` y `origin='manual'`.
*   **CA-06 — Aviso**: si la reserva tiene organizador (web) inserta **un**
    `reservation_cancelled` para el organizador, con el mismo payload de TDD-0008 v2 (sin
    campos nuevos). El `UNIQUE (reservation_id, kind)` impide duplicarlo si el jugador ya
    había cancelado. Las manuales no generan aviso.
*   **CA-07 — Atomicidad**: UPDATE y aviso en una sola transacción; cualquier error revierte
    ambos. Dos cancelaciones simultáneas producen una transición y un aviso.
*   **CA-08 — Liberación**: la reserva cancelada deja de ocupar el intervalo (las consultas
    usan `status='reserved'`).

## Diseño Técnico (RFC)

### Modelo de Datos
Sin columnas nuevas. Usa la migración `006_reservation_cancellation_notice.sql`
(TDD-0010), que solo ensancha el CHECK de `reservation_notices.kind` a
`('reservation_confirmed','reservation_cancelled')`.

Orden único de locks para todo escritor de reservas:
`complejo FOR SHARE → cancha FOR UPDATE → reserva FOR UPDATE`. No se exige que complejo ni
cancha estén activos para poder cancelar una reserva existente.

### Contrato de API (C2)
*   **Endpoint**: `POST /api/v1/complexes/{complexId}/reservations/{reservationId}/cancel`
*   **Autenticación**: `Authorization: Bearer <JWT>`. **Request**: sin body ni query.
*   **Headers**: `Cache-Control: no-store`.
*   **Response `200`**:
```json
{
  "reservation": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "cancelled",
    "complex": { "id": "…", "name": "Complejo Norte" },
    "court": { "id": "…", "name": "Cancha 1" },
    "date": "2026-11-03",
    "startsAt": "18:00",
    "endsAt": "19:30",
    "timeZone": "America/Argentina/Buenos_Aires"
  }
}
```
No se devuelve nombre ni teléfono de contacto. Errores: `{"error":"mensaje"}`.

### Componentes del Monolito Modular
*   **Modelo**: errores `ErrNotFound`, `ErrForbidden`, `ErrConflict` y `ErrTooLate`/`ErrFinished`
    del paquete `reservations`.
*   **Servicio HTTP**: valida UUID y ausencia de query/body, resuelve el actor del JWT y
    mapea errores. Reutiliza el núcleo `cancel(...)` con política "encargado".
*   **Repositorio**: transacción con locks en orden, reloj inyectable, UPDATE condicionado a
    `status='reserved'` y aviso condicional.

## Casos de Borde y Errores
| Escenario | Resultado Esperado | Código HTTP |
| --- | --- | --- |
| UUID inválido, query o body inesperados | Sin escrituras | 400 Bad Request |
| Sin token válido | `no autorizado` | 401 Unauthorized |
| Jugador o encargado de otro complejo | Sin revelar si el complejo existe | 403 Forbidden |
| Complejo inexistente (actor administrador) | `recurso no encontrado` | 404 Not Found |
| Reserva inexistente o de otro complejo | `recurso no encontrado` | 404 Not Found |
| Reserva `reserved` con `ends_at <= now` | `la reserva ya finalizó`, sin escrituras | 409 Conflict |
| Reserva ya cancelada | Idempotente, sin escrituras ni aviso nuevo | 200 OK |
| Falla el insert del aviso | Rollback del estado | 500 Internal Server Error |

## Plan de Implementación
1. Aprobar criterios y contrato en la revisión de la PR.
2. Red: pruebas unitarias, HTTP y PostgreSQL (aviso único, rollback, concurrencia contra
   altas, bajas de cancha y cambios de horario en ambos órdenes de lock).
3. Green: núcleo `cancel(...)` compartido con HU-14 y dos handlers.
4. Refactor y documentación en `docs/backend/HU-14-implementacion.md`.
