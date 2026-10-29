---
id: "0008"
estado: Propuesta autorizada para implementar
version: 1
autor: "Equipo backend"
fecha: "2026-10-28"
titulo: "Consulta de confirmaciones de reservas propias"
hu: HU-06
capa: backend
trello: "https://trello.com/c/dIhIwmhH"
---

# TDD-0008: Consulta de confirmaciones de reservas propias

## Contexto de Negocio (PRD)

### Objetivo
Permitir que el organizador consulte el aviso persistido de confirmación de su reserva. La tarjeta HU-06 pide una confirmación con complejo, cancha, día y hora; esta operación ofrece la consulta interna, sin afirmar envío externo ni una integración de interfaz que aún no exista.

### User Persona
- **Rol:** jugador que organizó la reserva.
- **Necesidad:** consultar su confirmación sin acceder a avisos de otras personas.

### Criterios de Aceptación
- **CA-01:** el usuario autenticado consulta únicamente sus avisos de confirmación, identificados por el JWT, en orden descendente de creación y de ID.
- **CA-02:** cada aviso incluye identificador, tipo, fecha de creación y la información de confirmación guardada al crear la reserva. La respuesta no expone datos de contacto. Si no existen avisos propios, devuelve una lista vacía.
- **CA-03:** sin JWT válido se responde `401`; los parámetros de consulta se rechazan con `400`. No se acepta un identificador de otro destinatario.
- **CA-04:** la consulta no modifica avisos ni reservas. No marca avisos como leídos; esa operación queda fuera del contrato.

## Diseño Técnico (RFC)

### Modelo de Datos
Leer `reservation_notices` de la migración de alta: `id`, `user_id`, `kind`, `created_at` y `payload`. El payload es la instantánea de confirmación persistida en la transacción de alta, sin teléfono. No añadir tablas, migraciones ni procesos adicionales.

### Contrato de API
- **Endpoint:** `GET /api/v1/reservation-notices`.
- **Headers:** `Authorization: Bearer <JWT>`. No admite parámetros de consulta.
- **Response:** `200 OK`; `Cache-Control: no-store`.

```json
{
  "notices": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "type": "reservation_confirmed",
      "createdAt": "2026-10-28T15:00:00Z",
      "reservation": {
        "id": "6ba7b810-9dad-41d1-80b4-00c04fd430c8",
        "status": "reserved",
        "complex": { "id": "6ba7b811-9dad-41d1-80b4-00c04fd430c8", "name": "Complejo Norte" },
        "court": { "id": "6ba7b812-9dad-41d1-80b4-00c04fd430c8", "name": "Cancha 1" },
        "date": "2026-11-03",
        "startsAt": "18:00",
        "endsAt": "19:30",
        "timeZone": "America/Argentina/Buenos_Aires"
      }
    }
  ]
}
```

Sin avisos: `{"notices":[]}`. El contenido del aviso conserva la instantánea creada al reservar, aunque posteriormente cambien nombres del complejo o cancha.

### Componentes del Monolito Modular
- **Servicio HTTP:** autenticación existente, rechazo de parámetros y respuesta sin caché.
- **Repositorio:** lectura SQL parametrizada por `user_id` del contexto autenticado, sin escrituras ni lectura de contactos.
- **Rutas:** agregar esta operación sin modificar los contratos de alta y consulta de reservas.

## Casos de Borde y Errores
| Escenario | Resultado | HTTP |
| --- | --- | --- |
| JWT ausente, inválido o usuario inexistente | Sin datos | 401 |
| Parámetros de consulta | Sin datos | 400 |
| Sin avisos propios, aun si existen de otro usuario | Lista vacía | 200 |
| Error de persistencia | Sin detalles internos | 500 |

## Plan de Implementación
1. Integración HTTP y PostgreSQL descartable: crear una reserva y leer su aviso, verificar aislamiento entre dos usuarios, autenticación, ausencia de contacto y rechazo de parámetros.
2. Confirmar que la consulta no altera la reserva ni el aviso y que los flujos previos permanecen iguales. Ejecutar `go test -count=1 ./...` y `go vet ./...` desde `backend/`.
3. La interfaz de usuario, paginación, lectura/marcado y avisos de otras operaciones son funcionalidades separadas. La aprobación de esta implementación no implica que las PR estén integradas ni que HU-06 esté completa.
