---
id: "0004"
estado: Aprobado
version: 1
autor: "Pedro Moyano Amaya"
fecha: "2026-10-22"
titulo: "Búsqueda administrativa de horarios recurrentes"
hu: HU-04
capa: backend
trello: "https://trello.com/c/PfnE8VXU"
---

# TDD-0004: Búsqueda administrativa de horarios recurrentes

> Contrato v1 aprobado explícitamente en la conversación del 27/10/2026. Implementación y límites: [HU-04 backend](../../../backend/HU-04.md). Las comprobaciones con reservas reales siguen pendientes.


## Contexto de Negocio (PRD)

### Objetivo
Consultar la configuración persistida de una cancha, por día o para la semana, para administrarla desde distintos navegadores ([RN-09](../../REGLAS-NEGOCIO.md)).

### User Persona
- **Nombre / rol:** encargado de un complejo.
- **Necesidad:** ver sus horarios actuales y editar un día a partir de la revisión vigente.

### Criterios de Aceptación
- **CA-01:** devolver configuración de una cancha y complejo activos al encargado asignado a ese complejo o al administrador general. Denegar a otros roles o encargados ajenos (RN-12).
- **CA-02:** la búsqueda semanal devuelve los días configurados ordenados de lunes a domingo; la búsqueda individual devuelve solo el día indicado. Dentro del día, ordenar franjas por apertura.
- **CA-03:** una cancha válida sin días configurados responde `200` con `days: []` en la búsqueda semanal; un día individual no configurado responde `404`. No crear días ni devolver valores inventados.
- **CA-04:** incluir revisión y configuración completa de cada día, incluso deshabilitados con sus franjas y duración conservadas (RN-13). Un día dado de baja no aparece. Lectura consistente de cabecera y franjas durante una modificación concurrente.
- **CA-05:** no mezclar reservas, bloqueos por fecha ni turnos generados con esta respuesta; interpretar horas locales con [RN-07](../../REGLAS-NEGOCIO.md).

## Diseño Técnico (RFC)

### Modelo de Datos
Sin tablas nuevas respecto del [alta](TDD-0001-hu-04-alta-horario-diario.md#modelo-de-datos). Consultar por cancha y opcionalmente por día con una lectura SQL consistente; no combinar cabecera vieja y franjas nuevas entre consultas separadas sin aislamiento.

### Contrato de API
- **Endpoints:** `GET /api/v1/complexes/{complexId}/courts/{courtId}/weekly-schedule/days` y `GET /api/v1/complexes/{complexId}/courts/{courtId}/weekly-schedule/days/{weekday}`.
- `weekday` es entero `1..7` en la búsqueda individual. Sin query params ni paginación: máximo siete días en la búsqueda semanal; rechazar parámetros de consulta no admitidos.
- **Headers:** JWT; no requiere `If-Match`. **Request Body:** ninguno.
- **Response semanal:** `200 OK`, `Content-Type: application/json` y `Cache-Control: no-store`.

```json
{
  "days": [
    {
      "weekday": 1,
      "enabled": true,
      "durationMinutes": 60,
      "revision": "9ad461f4-86b5-459b-854c-1ddf15d9b033",
      "intervals": [{ "id": "0df09989-542c-49f9-8fe4-c3596827bce9", "opensAt": "09:00", "closesAt": "13:00" }]
    }
  ]
}
```

- **Response individual:** `200 OK`, mismos headers y cuerpo `{"day": ...}` del [alta](TDD-0001-hu-04-alta-horario-diario.md#contrato-de-api); `404` si no está configurado. Es la representación del recurso indicado en `Location` al darlo de alta.
- Autenticación y errores JSON: [contrato común](README.md#hu-04-acuerdos-y-contrato-común-aprobado). Después de un `412` al modificar/eliminar, buscar de nuevo y mostrar el conflicto; no sobrescribir automáticamente.
- El frontend puede consultar `/days/1` para editar lunes. Adaptación y conexión requieren tarea autorizada aparte; su almacenamiento local actual no equivale a persistencia backend.

### Componentes del Monolito Modular
- **Modelo:** reutilizar día y franjas; validación del día solicitado.
- **Servicio HTTP:** comprobar acceso al complejo/cancha y serializar el DTO, sin escritura.
- **Repositorio:** lectura consistente, aislamiento por cancha y orden determinista.

## Casos de Borde y Errores
| Escenario | Resultado esperado | HTTP |
| --- | --- | --- |
| Búsqueda semanal sin configuración | `{"days":[]}`, sin valores por defecto | 200 |
| Búsqueda individual de día no configurado | Error, sin crear el día | 404 |
| Día o parámetros de consulta inválidos | Error de validación | 400 |
| Sin JWT / sin permiso / recurso inexistente | Según contrato común, sin filtrar datos ajenos | 401 / 403 / 404 |
| Falla de base de datos | Error; no devolver lista vacía como si fuera éxito | 500 |

## Plan de Implementación
1. Aprobar el contrato frontend y el TDD, con los permisos y la diferencia entre días ausentes/deshabilitados ya acordados.
2. Red → Green HTTP de CA-01/02/03: semana, día, orden, ausencia y permisos.
3. Red → Green PostgreSQL real de CA-04: otra conexión ve lo persistido, incluidos días deshabilitados y ausencia de los eliminados; sin mezcla de revisiones bajo edición concurrente. Verificar CA-05 en el DTO.
4. Refactor y evidencia de pruebas por criterio en PR. Los ciclos ejecutados y los límites de implementación están registrados en la documentación backend vinculada.
