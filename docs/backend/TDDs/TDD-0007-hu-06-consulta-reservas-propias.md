---
id: "0007"
estado: Propuesta autorizada para implementar
version: 1
autor: "Equipo backend"
fecha: "2026-10-28"
titulo: "Consulta de reservas propias por fecha"
hu: HU-06
capa: backend
trello: "https://trello.com/c/dIhIwmhH"
---

# TDD-0007: Consulta de reservas propias por fecha

> Operación acotada para comprobar una reserva tras perder la respuesta de alta. El usuario autorizó continuar sin esperar revisión de la PR; no se presenta como acuerdo histórico del equipo.

## Contexto de Negocio (PRD)

### Objetivo
Permitir que la persona autenticada compruebe las reservas vigentes que organizó en una fecha, antes de repetir manualmente una solicitud cuya respuesta no recibió. Esta consulta no garantiza idempotencia del alta.

### User Persona
- **Rol:** jugador organizador.
- **Necesidad:** comprobar si su reserva fue guardada sin consultar datos de otras personas.

### Criterios de Aceptación
- **CA-01:** devolver solo reservas `reserved` cuyo organizador sea la identidad del JWT y cuyo inicio pertenezca a la fecha solicitada en `America/Argentina/Buenos_Aires` (RN-07).
- **CA-02:** incluir ID, estado, complejo, cancha, fecha, inicio y fin reales; no devolver teléfono o nombre de contacto. Si no hay resultados, responder una lista vacía.
- **CA-03:** rechazar solicitudes sin autenticación o con fecha ausente, inválida, duplicada o con parámetros adicionales. No aceptar identidad de otra persona.
- **CA-04:** no modificar reservas, avisos ni el comportamiento de alta existente.

## Diseño Técnico (RFC)

### Modelo de Datos
Consultar las tablas `reservations`, `complexes` y `courts` de la operación de alta. No agregar migraciones. La búsqueda limita `starts_at` al intervalo entre medianoches locales consecutivas, con límite inicial inclusivo y final exclusivo. Ordenar por inicio e ID. No filtrar complejos o canchas dados de baja para no ocultar una reserva previamente guardada.

### Contrato de API
- **Endpoint:** `GET /api/v1/reservations?date=2026-11-03`.
- **Headers:** `Authorization: Bearer <JWT>`. La fecha `date` es obligatoria, única y tiene formato `AAAA-MM-DD`; no se aceptan otros parámetros.
- **Response `200 OK`:**

```json
{
  "reservations": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "status": "reserved",
      "complex": { "id": "6ba7b810-9dad-41d1-80b4-00c04fd430c8", "name": "Complejo Norte" },
      "court": { "id": "6ba7b811-9dad-41d1-80b4-00c04fd430c8", "name": "Cancha 1" },
      "date": "2026-11-03",
      "startsAt": "18:00",
      "endsAt": "19:30",
      "timeZone": "America/Argentina/Buenos_Aires"
    }
  ]
}
```

Sin resultados: `{"reservations":[]}`. Los nombres reflejan los valores actuales, no una instantánea histórica. `Cache-Control: no-store` evita almacenar datos de la consulta.

### Componentes del Monolito Modular
- **Servicio HTTP:** verificar identidad, validar fecha y responder sin datos de terceros.
- **Repositorio:** lectura SQL parametrizada por `organizer_id` y límites de fecha; sin escrituras ni acceso a teléfonos.
- **Rutas:** agregar únicamente la consulta autenticada; conservar el alta.

## Casos de Borde y Errores
| Escenario | Resultado | HTTP |
| --- | --- | --- |
| Falta JWT, inválido o usuario inexistente | Sin datos | 401 |
| Fecha inválida, ausente o repetida; parámetros adicionales | Sin consulta | 400 |
| No hay reservas propias para esa fecha | Lista vacía | 200 |
| Reservas de otras personas para la misma fecha | No aparecen | 200 |
| Falla de consulta | Sin detalles internos | 500 |

## Plan de Implementación
1. Mantener acotada esta operación; una agenda completa, historial, cancelaciones o consulta de avisos requieren contratos separados.
2. Red → Green → Refactor de validación de fecha y criterios observables. Agregar integración HTTP/PostgreSQL descartable de aislamiento entre dos usuarios, fecha y alta anterior (CA-01 a CA-04).
3. Ejecutar `go test -count=1 ./...` y `go vet ./...` desde `backend/`; las pruebas PostgreSQL quedan pendientes hasta disponer de una base descartable. No confundir su omisión con una verificación de aislamiento o persistencia.
