---
id: "0003"
estado: Borrador
version: 1
autor: "Pedro Moyano Amaya"
fecha: "2026-10-22"
titulo: "Modificación de horario diario recurrente"
hu: HU-04
capa: backend
trello: "https://trello.com/c/PfnE8VXU"
---

# TDD-0003: Modificación de horario diario recurrente

> Borrador. Las reglas RN-09 a RN-15 están acordadas, incluida la nueva duración solo para nuevas reservas. El contrato y las demás validaciones requieren aprobación antes de implementar.

## Contexto de Negocio (PRD)

### Objetivo
Editar juntas las franjas y duración de un día existente, sin reemplazar la semana ni alterar reservas sin consentimiento ([RN-06, RN-09, RN-10 y RN-11](../../REGLAS-NEGOCIO.md)).

### User Persona
- **Nombre / rol:** encargado de un complejo.
- **Necesidad:** cambiar el lunes de una cancha sin tocar su martes ni perder cambios realizados por otra persona.

### Criterios de Aceptación propuestos
- **CA-01:** modificar solo días existentes de una cancha y complejo activos; permitir al encargado asignado a ese complejo y al administrador general, denegar a otros roles o encargados ajenos (RN-12).
- **CA-02:** sustituir todas las franjas del día indicado en una transacción; los otros días quedan intactos. No crear días mediante esta operación.
- **CA-03:** aplicar las validaciones del [alta, CA-03/04](TDD-0001-hu-04-alta-horario-diario.md#criterios-de-aceptación-propuestos). No modificar `weekday`; cambiar de día requiere acordar otro flujo.
- **CA-04:** rechazar íntegramente cambios que afecten reservas futuras vigentes y mantener la configuración anterior (RN-10), por ejemplo reducir una franja dejando una reserva fuera del horario. Deshabilitar según CA-06 o cambiar duración según CA-07 sí se permite sin alterar esas reservas. No mover ni cancelar reservas desde este endpoint; la reprogramación es una funcionalidad separada.
- **CA-05:** si dos ediciones parten de la misma revisión, una sola puede aplicarse. La otra debe volver a consultar y revisar sus cambios, sin reintento que sobrescriba silenciosamente.
- **CA-06:** deshabilitar conserva franjas y duración e impide nuevas reservas; reactivar recupera esa configuración (RN-13). Se permite deshabilitar con reservas futuras: siguen vigentes y se juegan normalmente, sin cambiar horarios ni duración. Cambiar solo la habilitación no elimina ni recrea franjas. No rechazar esta operación únicamente porque existan reservas.
- **CA-07:** permitir cambiar entre 60 y 90 minutos aunque existan reservas futuras. La nueva duración rige para nuevas reservas; las existentes conservan sus horarios y duración originales (RN-14). No permitir nuevos turnos que se superpongan con ellas.

## Diseño Técnico (RFC) propuesto

### Modelo de Datos
Usar el [modelo del alta](TDD-0001-hu-04-alta-horario-diario.md#modelo-de-datos). Conservar `(court_id, weekday)`; generar nueva revisión UUID en la misma transacción. Si se edita el conjunto de franjas, reemplazarlo con nuevos IDs; si solo cambia `enabled`, conservar las franjas y sus IDs, además de la duración. Estos IDs no referencian reservas ni turnos concretos.

Comparar revisión y comprobar reservas afectadas dentro de una protección coordinada con nuevas reservas concurrentes. Un fake no demuestra CA-04 ni permite dar por disponible esa dependencia.

Cambiar `duration_minutes` del día no actualiza reservas ni recalcula su final. El modelo del módulo de reservas debe conservar sus propios inicio, fin y duración de confirmación; su diseño pertenece a su TDD. Disponibilidad y confirmación de reservas deben respetar el intervalo real ocupado, aunque difiera de la nueva duración diaria.

### Contrato de API
- **Endpoint:** `PUT /api/v1/complexes/{complexId}/courts/{courtId}/weekly-schedule/days/{weekday}`.
- **Headers:** JWT e `If-Match: "<revision>"` de la última lectura del día.
- **Request Body** completo para ese día; sin `weekday`, revisión ni IDs de franjas:

```json
{
  "enabled": true,
  "durationMinutes": 90,
  "intervals": [{ "opensAt": "17:00", "closesAt": "21:30" }]
}
```

- **Response:** `200 OK`; mismo cuerpo `{"day": ...}` del [alta](TDD-0001-hu-04-alta-horario-diario.md#contrato-de-api), con valores vigentes y nueva revisión. Solo cambia IDs de franjas si se reemplazó su conjunto. No devuelve el resto de la semana.
- Omisión de una franja significa quitarla de ese día; cuerpo parcial es `400`. Formato de errores y revisión: [contrato común](README.md#hu-04-acuerdos-y-contrato-común-propuesto).
- Para deshabilitar o reactivar, enviar el cuerpo completo con `enabled: false` o `true` y conservar `durationMinutes` e `intervals`. Usar DELETE únicamente si se desea eliminar la configuración.

### Componentes del Monolito Modular
- **Modelo:** reutilizar validaciones del alta y reglas sobre reservas, sin duplicarlas.
- **Servicio HTTP:** permisos, contrato completo y conflictos; nunca interpretar PUT como alta.
- **Repositorio:** reemplazo del día condicionado por revisión, protección de reservas y rollback.

## Casos de Borde y Errores
| Escenario | Resultado esperado | HTTP |
| --- | --- | --- |
| Día inexistente | No crear automáticamente | 404 |
| Duración, franjas o cuerpo inválidos | Mantener configuración anterior completa | 400 |
| Cambio que afecta reservas vigentes | Mantener configuración y reservas intactas (RN-10) | 409 |
| Franja de 22:00 a 02:00 | Rechazar por cruce de medianoche (RN-11) | 400 |
| Deshabilitar aunque existan reservas futuras | Impedir nuevas reservas, conservar configuración y reservas existentes; cambiar habilitación y revisión | 200 |
| Reactivar sin cambiar franjas ni duración | Recuperar configuración y cambiar revisión; no alterar reservas | 200 |
| Cambiar a 90 minutos con una reserva de 60 ya confirmada | Guardar 90 para nuevas reservas; mantener inicio, fin y duración de la existente | 200 |
| Falta revisión / revisión desactualizada | No sobrescribir | 428 / 412 |
| Sin JWT / sin permiso / recurso inexistente | Según contrato común | 401 / 403 / 404 |
| Falla de persistencia | Restaurar íntegramente el estado anterior | 500 |

## Plan de Implementación
1. Revisar criterios, modelo y contrato frontend; aprobar el TDD sin confundir aprobación de reglas con autorización para implementar.
2. Red → Green unitario/HTTP de CA-01/03, incluida omisión de campos y día inexistente.
3. Red → Green PostgreSQL real de CA-02/04/05/06/07: rollback, protección de reservas, dos ediciones, carrera con nuevas reservas, deshabilitación y cambio de duración sin alterar reservas existentes. Con los módulos reales, verificar que no se reserva estando deshabilitado ni se ofrecen/confirman turnos de 90 minutos que solapen una reserva previa de 60; sin esa integración no declarar CA-06/07 completos.
4. Refactor con pruebas verdes y evidencia por criterio en PR. No hay ciclos ejecutados ni aprobación de implementación.
