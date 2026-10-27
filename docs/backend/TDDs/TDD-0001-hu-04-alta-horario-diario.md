---
id: "0001"
estado: Borrador
version: 1
autor: "Pedro Moyano Amaya"
fecha: "2026-10-22"
titulo: "Alta de horario diario recurrente"
hu: HU-04
capa: backend
trello: "https://trello.com/c/PfnE8VXU"
---

# TDD-0001: Alta de horario diario recurrente

> Reglas RN-09 a RN-15 acordadas. El modelo, contrato y demás validaciones siguen propuestos; requieren aprobación antes de implementar. Ver [contrato común](README.md#hu-04-acuerdos-y-contrato-común-propuesto).

## Contexto de Negocio (PRD)

### Objetivo
Registrar las franjas de un día de la semana para una cancha, sin reemplazar los otros días ([RN-09](../../REGLAS-NEGOCIO.md)).

### User Persona
- **Nombre / rol:** encargado de un complejo.
- **Necesidad:** configurar, por ejemplo, los lunes de 09:00 a 13:00 y de 17:00 a 22:00, con turnos de 60 minutos.

### Criterios de Aceptación propuestos
- **CA-01:** crear solo un día no configurado de una cancha y complejo activos. Permitir al encargado asignado a ese complejo y al administrador general (RN-12); denegar a otros roles o encargados ajenos.
- **CA-02:** persistir juntas todas sus franjas y la duración del día; no modificar los otros días.
- **CA-03:** exigir una duración de 60 o 90 minutos para nuevas reservas, común a todas las franjas del día ([RN-14](../../REGLAS-NEGOCIO.md)). Rechazar días duplicados, otras duraciones, horas inválidas y franjas superpuestas. Franjas contiguas sí se permiten; cada franja debe admitir al menos un turno.
- **CA-04:** horas `00:00..23:59` del mismo día, con cierre posterior a apertura; no aceptar cruces de medianoche ([RN-11](../../REGLAS-NEGOCIO.md)). Si está habilitado, se propone exigir al menos una franja.
- **CA-05:** un error no persiste parte del día; dos altas concurrentes del mismo día producen una sola configuración.

## Diseño Técnico (RFC) propuesto

### Modelo de Datos
- Entidad Go `ScheduleDay`; tabla propuesta `court_schedule_days`: `court_id` UUID FK a cancha, `weekday` entero `1..7`, `enabled` booleano, `duration_minutes` entero `60/90`, `revision` UUID. Unicidad `(court_id, weekday)`.
- Franjas en `court_schedule_intervals`: `id` UUID generado por servidor, FK al día, `opens_at` y `closes_at` como horas locales. Sus IDs no identifican reservas ni turnos concretos.
- Migración numerada al implementar, después de integrar el esquema de canchas. Cabecera y franjas en una transacción; restricciones SQL además de validaciones Go.

### Contrato de API
- **Endpoint:** `POST /api/v1/complexes/{complexId}/courts/{courtId}/weekly-schedule/days`.
- Autenticación, permisos y formato de errores: [contrato común](README.md#hu-04-acuerdos-y-contrato-común-propuesto).
- **Request Body** (todos los campos mostrados son obligatorios; franjas sin IDs):

```json
{
  "weekday": 1,
  "enabled": true,
  "durationMinutes": 60,
  "intervals": [{ "opensAt": "09:00", "closesAt": "13:00" }]
}
```

- **Response:** `201 Created`; `Location` apunta al recurso `/days/1`.

```json
{
  "day": {
    "weekday": 1,
    "enabled": true,
    "durationMinutes": 60,
    "revision": "9ad461f4-86b5-459b-854c-1ddf15d9b033",
    "intervals": [{ "id": "0df09989-542c-49f9-8fe4-c3596827bce9", "opensAt": "09:00", "closesAt": "13:00" }]
  }
}
```

### Componentes del Monolito Modular
- **Modelo:** día y validación de franjas; ordenar por apertura antes de validar solapamientos.
- **Servicio HTTP:** validar contrato y pertenencia; traducir resultados al código HTTP.
- **Repositorio:** inserción transaccional, unicidad bajo concurrencia y rollback. Composición de rutas en `cmd/api`.

## Casos de Borde y Errores
| Escenario | Resultado esperado | HTTP |
| --- | --- | --- |
| Día ya configurado, incluso en otra solicitud concurrente | No sobrescribirlo; usar modificación | 409 |
| Día, duración, franjas o JSON inválidos | No persistir | 400 |
| Franja de 22:00 a 02:00 | Rechazar por cruce de medianoche, sin persistir | 400 |
| Sin JWT / sin permiso / recurso inexistente | Según contrato común, sin escritura | 401 / 403 / 404 |
| Encargado de otro complejo / administrador general sin asignación | Denegar al encargado; permitir al administrador si los demás datos son válidos | 403 / 201 |
| Falla de persistencia | Rollback de día y franjas | 500 |

## Plan de Implementación
1. Revisar las propuestas técnicas y aprobar documento y contrato frontend. Duraciones, permisos y diferencia entre deshabilitar y dar de baja ya están acordados.
2. Red → Green de CA-03/04: duraciones, horas, contigüidad, solapamiento y datos faltantes.
3. Red → Green HTTP de CA-01 y PostgreSQL real de CA-02/05: permisos, unicidad concurrente y rollback.
4. Refactor con pruebas verdes; registrar comandos/resultados y trazabilidad en la PR. No hay ciclos ejecutados ni aprobación de implementación.
