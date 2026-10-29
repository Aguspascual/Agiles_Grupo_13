---
id: "0009"
estado: "Aprobado e integrado en Desarrollo mediante PR #18"
version: 2
autor: "Equipo backend"
fecha: "2026-10-29"
titulo: "Consulta pública de disponibilidad de turnos por complejo y fecha"
hu: HU-05
capa: backend
trello: "Pendiente de confirmar la tarjeta HU-05 backend"
---

# TDD-0009: Consulta pública de disponibilidad de turnos

> **Versión 2 aprobada.** Pedro Moyano aprobó este TDD y fue integrado en Desarrollo
> mediante la [PR #18](https://github.com/Aguspascual/Agiles_Grupo_13/pull/18). Esta
> versión define el alcance autorizado para HU-05 backend.

## Contexto de negocio

### Objetivo

Consultar en PostgreSQL la disponibilidad de turnos de un complejo para una fecha,
calculando los candidatos a partir de horarios recurrentes y la ocupación a partir de
reservas vigentes. La consulta no persiste turnos libres ni altera las reservas.

### Persona

- **Rol:** persona que consulta un complejo, con o sin sesión.
- **Necesidad:** distinguir turnos disponibles, ocupados y bloqueados antes de iniciar
  una reserva.

### Reglas relacionadas

- **RN-07:** interpretar fechas con `America/Argentina/Buenos_Aires` y el reloj del
  servidor.
- **RN-09 y RN-11:** las configuraciones son recurrentes por día y sus franjas terminan
  dentro del mismo día.
- **RN-13:** deshabilitar un día impide altas nuevas, conserva configuración y reservas.
- **RN-14:** cambiar la duración solo afecta turnos nuevos; las reservas conservan sus
  timestamps originales.

## Criterios de aceptación propuestos

- **CA-01 — Consulta pública:** `GET` no requiere JWT y devuelve disponibilidad de un
  complejo para una fecha. No depende de una sesión.
- **CA-02 — Recursos activos:** complejo inexistente o inactivo devuelve `404`. Solo se
  devuelven canchas activas; un complejo activo sin canchas devuelve `courts: []`.
- **CA-03 — Fecha:** `date` es obligatorio, único y formato estricto `AAAA-MM-DD`. Se
  interpreta en `America/Argentina/Buenos_Aires`. La ventana propuesta es hoy local
  hasta hoy + 13 días inclusive.
- **CA-04 — Turnos candidatos:** solo la configuración recurrente existente puede
  generar `slots`. Para cada franja, generar inicios avanzando por `duration_minutes`
  (60 o 90) desde `opens_at`; incluir el turno si su fin no supera `closes_at`. No
  inventar candidatos cuando falte configuración. Los candidatos no cruzan medianoche.
- **CA-05 — Estado de cada candidato:** en día habilitado, si el candidato se solapa con
  cualquier reserva vigente, marcarlo `RESERVED`; de lo contrario `AVAILABLE`. En día
  deshabilitado, marcar `RESERVED` donde exista solapamiento con una reserva vigente y
  `BLOCKED` en los demás candidatos. Un día deshabilitado nunca admite reservas nuevas,
  incluso sobre candidatos mostrados como `RESERVED`; HU-06 revalida `enabled` al crear.
- **CA-06 — Solapamiento:** comparar intervalos semiabiertos `[inicio, fin)` con la
  condición estricta `reservation.starts_at < slot.endsAt AND reservation.ends_at >
  slot.startsAt`. Un límite que coincide (fin de reserva igual a inicio de turno, o
  inicio de reserva igual al fin de turno) no se solapa. Ningún candidato que se
  solape con una reserva vigente puede ser `AVAILABLE`.
- **CA-07 — Duración histórica:** usar los `starts_at` y `ends_at` persistidos. Un cambio
  posterior de duración o grilla no recalcula ni mueve la reserva. Todo candidato que
  solape la reserva queda `RESERVED`, pero esos candidatos no son reservas adicionales.
- **CA-08 — Intervalos ocupados:** devolver cada reserva vigente una sola vez en
  `occupiedIntervals`, independientemente de cuántos candidatos solape. Esta estructura
  representa reservas persistidas; `slots` representa candidatos de la grilla. Ambos
  campos son arrays y quedan como `[]` cuando no tienen elementos. Una reserva fuera de
  grilla aparece en `occupiedIntervals` aunque no haya candidato coincidente. No exponer
  ID de reserva, identidad, contacto ni datos de acompañantes.
- **CA-09 — Cruce de medianoche:** consultar reservas que se solapan con el día local y
  devolver un fragmento visible limitado a `[inicioDelDía, inicioDelDíaSiguiente)`, sin
  modificar la reserva. La respuesta incluye tanto los límites originales completos
  como los límites del fragmento visible, en ISO 8601 con offset. Una misma reserva de
  más de un día aparece una vez como fragmento en cada respuesta diaria afectada.
- **CA-10 — Estados disponibles en v1:** solo `AVAILABLE`, `RESERVED` y `BLOCKED`.
  No simular partidos pendientes, clases, pagos ni bloqueos excepcionales que no estén
  persistidos.
- **CA-11 — Turnos pasados:** incluir los candidatos del día actual y marcar `isPast`
  cuando su inicio sea menor o igual al reloj del servidor. El estado de ocupación se
  calcula de igual manera; el turno pasado no se vuelve reservable por aparecer
  `AVAILABLE`.
- **CA-12 — Privacidad:** no devolver identificador de reserva, organizador, nombre,
  teléfono, acompañantes, pagos ni avisos. SQL no selecciona columnas personales.
- **CA-13 — Orden y estabilidad:** ordenar canchas por `name` y UUID, candidatos por
  inicio y los intervalos ocupados por inicio original y fin original. El ID derivado
  del candidato es `courtId:AAAA-MM-DD:HH:MM`; no es ID de reserva ni credencial.
- **CA-14 — Persistencia y consistencia:** leer complejo, canchas, horarios y reservas
  desde un snapshot PostgreSQL de solo lectura. Validar una copia en memoria de los
  horarios con las reglas existentes; una inconsistencia falla cerrada con `500` y no
  modifica PostgreSQL.
- **CA-15 — Carrera de reserva:** `AVAILABLE` es informativo; una reserva concurrente
  puede cambiar el resultado. HU-06 vuelve a verificar horario activo y solapamiento
  bajo el lock de cancha y responde conflicto si ya no está libre.

## Diseño técnico propuesto

### Modelo de datos

No se proponen tablas nuevas. La consulta combina:

- `complexes.deleted_at` para resolver un complejo activo.
- `courts.deleted_at` y `courts.complex_id` para las canchas activas.
- `court_schedule_days.weekday`, `enabled`, `duration_minutes` y
  `court_schedule_intervals.opens_at/closes_at` para generar candidatos.
- `reservations.starts_at`, `ends_at` y `status`; solo `reserved` ocupa.

La migración 005 limita estados a `reserved`/`cancelled`; no hay persistencia de clases,
partidos pendientes, pagos ni bloqueos puntuales. La migración 004 valida cada franja,
pero no impone en SQL que dos intervalos semanales no se solapen. La lectura valida una
copia del borrador con `schedules.Draft.Validate()`; esa validación puede ordenar su
copia, pero no escribe en PostgreSQL.

### Contrato HTTP propuesto

- **Endpoint:** `GET /api/v1/complexes/{complexId}/slots?date=AAAA-MM-DD`.
- Público, sin `Authorization`; `complexId` debe ser UUID real.
- `date` debe aparecer exactamente una vez y ser el único parámetro de consulta.
- Ventana: hoy local a hoy + 13 días inclusive.
- `Cache-Control: no-store`.
- En `slots`, `startsAt` y `endsAt` son horas locales `HH:mm` de los turnos candidatos.
- En `occupiedIntervals`, todos los límites son timestamps ISO 8601 completos con
  offset. Los límites originales describen la fila persistida; los visibles son la
  intersección de ese intervalo con el día consultado.

#### Ejemplo obligatorio 1: una reserva abarca dos candidatos nuevos

Grilla actual: `18:00–19:00`, `19:00–20:00`, `20:00–21:00`. La única reserva persistida
es `18:30–20:00`. El fin de la reserva coincide con el inicio del tercer candidato, por
lo que ese candidato no se solapa y puede quedar `AVAILABLE`. Los dos candidatos
`RESERVED` son visualizaciones de solapamiento, no dos reservas distintas.

```json
{
  "complex": {
    "id": "8b1f0000-0000-4000-8000-000000000001",
    "name": "La Cumbre Pádel",
    "address": "Calle 131 y 32",
    "zone": "San Carlos"
  },
  "date": "2026-10-30",
  "courts": [
    {
      "id": "c41a0000-0000-4000-8000-000000000001",
      "name": "Cancha 1",
      "covered": true,
      "slots": [
        {
          "id": "c41a0000-0000-4000-8000-000000000001:2026-10-30:18:00",
          "startsAt": "18:00",
          "endsAt": "19:00",
          "status": "RESERVED",
          "isPast": false
        },
        {
          "id": "c41a0000-0000-4000-8000-000000000001:2026-10-30:19:00",
          "startsAt": "19:00",
          "endsAt": "20:00",
          "status": "RESERVED",
          "isPast": false
        },
        {
          "id": "c41a0000-0000-4000-8000-000000000001:2026-10-30:20:00",
          "startsAt": "20:00",
          "endsAt": "21:00",
          "status": "AVAILABLE",
          "isPast": false
        }
      ],
      "occupiedIntervals": [
        {
          "originalStartsAt": "2026-10-30T18:30:00-03:00",
          "originalEndsAt": "2026-10-30T20:00:00-03:00",
          "visibleStartsAt": "2026-10-30T18:30:00-03:00",
          "visibleEndsAt": "2026-10-30T20:00:00-03:00"
        }
      ]
    }
  ]
}
```

La reserva está una sola vez en `occupiedIntervals`. Se excluyen identificador de reserva,
organizador y contacto. Cada candidato en `RESERVED` representa que ese tramo de grilla
se cruza con esa ocupación, no una reserva adicional.

#### Ejemplo obligatorio 2: reserva persistida que cruza medianoche

Para estos dos ejemplos se supone que la cancha no tiene configuración recurrente en los
días consultados; por eso `slots` queda vacío. Solo se muestran las ocupaciones
persistidas. Cada día devuelve el fragmento visible dentro de sus límites locales
semiabiertos; los límites originales se repiten para distinguirlos del fragmento.

Consulta del 30/10/2026:

```json
{
  "complex": {
    "id": "8b1f0000-0000-4000-8000-000000000001",
    "name": "La Cumbre Pádel",
    "address": "Calle 131 y 32",
    "zone": "San Carlos"
  },
  "date": "2026-10-30",
  "courts": [
    {
      "id": "c41a0000-0000-4000-8000-000000000001",
      "name": "Cancha 1",
      "covered": true,
      "slots": [],
      "occupiedIntervals": [
        {
          "originalStartsAt": "2026-10-30T23:30:00-03:00",
          "originalEndsAt": "2026-10-31T01:00:00-03:00",
          "visibleStartsAt": "2026-10-30T23:30:00-03:00",
          "visibleEndsAt": "2026-10-31T00:00:00-03:00"
        }
      ]
    }
  ]
}
```

Consulta del 31/10/2026:

```json
{
  "complex": {
    "id": "8b1f0000-0000-4000-8000-000000000001",
    "name": "La Cumbre Pádel",
    "address": "Calle 131 y 32",
    "zone": "San Carlos"
  },
  "date": "2026-10-31",
  "courts": [
    {
      "id": "c41a0000-0000-4000-8000-000000000001",
      "name": "Cancha 1",
      "covered": true,
      "slots": [],
      "occupiedIntervals": [
        {
          "originalStartsAt": "2026-10-30T23:30:00-03:00",
          "originalEndsAt": "2026-10-31T01:00:00-03:00",
          "visibleStartsAt": "2026-10-31T00:00:00-03:00",
          "visibleEndsAt": "2026-10-31T01:00:00-03:00"
        }
      ]
    }
  ]
}
```

Los fragmentos son `[2026-10-30T23:30:00-03:00, 2026-10-31T00:00:00-03:00)` y
`[2026-10-31T00:00:00-03:00, 2026-10-31T01:00:00-03:00)`. Son proyecciones de una
misma reserva original; no se parte ni modifica la fila en PostgreSQL, no se fabrica
ningún `slot` y no se ofrece un turno reservable a partir de estos fragmentos. En una
consulta por fecha, cada reserva aparece como máximo una vez en `occupiedIntervals`.

### Consulta SQL y consistencia

1. Validar UUID/fecha y ventana en el servicio usando `America/Argentina/Buenos_Aires`.
2. Abrir transacción de solo lectura `REPEATABLE READ`; complejo, canchas, horarios y
   reservas deben corresponder al mismo snapshot.
3. Leer complejo activo; si no existe, `404`.
4. Leer canchas activas y su configuración/intervalos del weekday, con orden estable por
   `court.name, court.id`.
5. Calcular límites locales `[inicioDelDía, inicioDelDíaSiguiente)` con `AddDate(0,0,1)`;
   no asumir que un día local se modela universalmente como 24 horas.
6. Consultar filas con `status='reserved'` y solapamiento de ese día:
   `starts_at < finDelDía AND ends_at > inicioDelDía`. Leer el ID internamente para
   deduplicar cada fila una sola vez; no devolverlo ni seleccionar nombre/teléfono de
   contacto u otros datos personales. Incluir reservas iniciadas el día anterior que
   aún ocupen parte del día consultado.
7. Generar candidatos únicamente desde configuración real. Marcar `RESERVED` si hay
   solapamiento real, incluso cuando `enabled=false`; si no hay reserva, `BLOCKED` para
   día deshabilitado y `AVAILABLE` para día habilitado. Una reserva cancelada no ocupa.
8. Agregar una única entrada a `occupiedIntervals` por reserva vigente y cancha. Conservar
   timestamps originales y calcular `visibleStartsAt=max(originalStartsAt,inicioDelDía)`
   y `visibleEndsAt=min(originalEndsAt,finDelDía)`. Emitir en ISO 8601 local con offset.
   Estos límites forman un intervalo semiabierto no vacío por el filtro SQL de solape.
9. Validar la copia de horarios sin persistir cambios; errores de configuración fallan
   cerrados con `500`. Commit/rollback de la lectura de solo lectura y responder.

Los límites semiabiertos permiten adyacencia sin colisión. Una reserva que ocupa más de
un candidato puede hacer que varios `slots` estén `RESERVED`, pero se representa una vez
en `occupiedIntervals`. Cambiar `duration_minutes` nunca reconstruye ni desplaza sus
timestamps originales.

### Componentes del monolito modular

- **Servicio HTTP:** validar UUID/fecha/ventana, zona horaria, JSON de salida y errores;
  la ruta pública debe registrarse antes de los patrones generales autenticados de
  `/api/v1/complexes/`.
- **Repositorio PostgreSQL:** snapshot de solo lectura; consultas parametrizadas; sin
  acceso a datos personales.
- **Generador:** construir `slots` desde configuración; proyectar ocupaciones reales en
  `occupiedIntervals`, sin convertir candidatos solapados en entidades de reserva.
- **Angular pendiente:** adaptar UUID reales del catálogo, traducir estados API en
  mayúsculas a estados del modelo visual y decidir la visualización/overlay de
  `occupiedIntervals` respecto de `slots`. No cambiar modelos ni contratos frontend sin
  aprobación. Los IDs demo como `complex-cumbre` no se mapean en backend.

## Casos de borde y errores

| Escenario | Resultado |
| --- | --- |
| Falta/repite `date`, query adicional o fecha inválida/fuera de ventana | `400` |
| UUID sintético o malformado | `400` |
| Complejo inexistente/inactivo | `404` |
| Cancha inactiva | Se excluye |
| Complejo activo sin canchas activas | `200`, `courts: []` |
| Sin horario recurrente | `slots: []`; solo reservas vigentes en `occupiedIntervals` |
| Día habilitado con reserva que solapa varios slots | Cada candidato solapado `RESERVED`; una entrada ocupada real |
| Día deshabilitado con reserva solapada | `RESERVED` en candidato solapado, `BLOCKED` en los demás; ninguna nueva reserva admitida |
| Día deshabilitado sin reserva | Todos los candidatos configurados `BLOCKED` |
| Reserva cancelada | No aparece en `occupiedIntervals` ni ocupa slots |
| Reserva que cruza medianoche | Un fragmento por consulta diaria, original íntegro conservado |
| Falla PostgreSQL/configuración inconsistente | `500` sin detalles internos ni escrituras |

## Pruebas propuestas

### Unitarias

- Parseo estricto de fecha, ventana 14 días y zona `America/Argentina/Buenos_Aires`.
- Grillas de 60/90 minutos, varias franjas, bordes exactos y tiempo sobrante.
- Intervalos semiabiertos: adyacencia libre y solapamiento parcial ocupado.
- Escenario 18:30–20:00 frente a slots 18–19, 19–20 y 20–21: dos `RESERVED`, el
  siguiente `AVAILABLE`, y exactamente un `occupiedInterval` con los límites originales.
- Día deshabilitado: reserva coincidente `RESERVED`, resto `BLOCKED`; todas las altas
  siguen prohibidas por HU-06.
- Cambio de grilla 60↔90: no alterar la ocupación histórica ni mostrar disponible ningún
  candidato solapado; reserva fuera de grilla representada una vez.
- Reserva cruzando medianoche: límites originales idénticos y fragmentos diarios
  exactos; no crear slots desde los fragmentos.
- Reserva cancelada, día sin configuración y día de inicio igual al reloj (`isPast`).
- Configuración solapada/inconsistente rechazada sin mutar la copia fuente ni PostgreSQL.

### HTTP

- GET anónimo; contrato, listas vacías, estados, orden estable y `Cache-Control: no-store`.
- `400` para UUID/fecha/parámetros inválidos; `404` para complejo ausente/inactivo;
  `500` para fallo de repositorio.
- Verificar ejemplos de salida con JSON decodificado, en particular los dos fragmentos
  de medianoche y la unicidad de `occupiedIntervals` por reserva y día.
- Asegurar ausencia de IDs de reserva y de datos de contacto/organizador.

### PostgreSQL real

- Usar `TEST_DATABASE_URL` solo contra base descartable; aplicar migraciones existentes
  001–005 en esquema aislado.
- Crear complejos/canchas activos e inactivos, configuraciones 60/90 y deshabilitadas;
  crear reservas vigentes/canceladas con HU-06 y filas controladas de duración histórica.
- Verificar ocupación exacta del ejemplo 1, reserva única pese a varios slots, estados de
  día deshabilitado y ausencia de `AVAILABLE` solapado.
- Verificar fragmentos de la reserva 2026-10-30 23:30 a 2026-10-31 01:00; consultar cada
  fecha y confirmar que la fila PostgreSQL no se dividió ni alteró.
- Insertar intervalos recurrentes solapados por SQL; comprobar fallo cerrado y snapshot
  de configuración/reservas idéntico antes y después.
- Probar carrera con alta HU-06: la lectura no bloquea ni reserva y el alta revalida
  bajo lock.
- Desde `backend/`, ejecutar `go test -count=1 ./...` y `go vet ./...`; informar
  explícitamente pruebas omitidas y motivos.

## Integración, alcance y decisiones pendientes

Los cambios de este TDD proponen separar datos de **candidatos** (`slots`) de
**ocupaciones persistidas** (`occupiedIntervals`). Es una extensión del contrato JSON
propuesto: no se edita `docs/contracts/hu-05-grilla-de-turnos.md` ni frontend sin
aprobación. Angular requiere:

1. Obtener UUID reales de complejos/canchas, no IDs sintéticos de demo.
2. Mapear `AVAILABLE/RESERVED/BLOCKED` al modelo visual; los estados demo `pending` y
   `class` no existen en esta primera versión.
3. Decidir cómo dibujar un intervalo real que ocupa varios candidatos o fragmentos
   diarios, manteniendo una reserva diferenciada de las celdas `RESERVED` que la
   representan.

Esta entrega cubre **solo la consulta de disponibilidad backend**. No completa HU-05 de
punta a punta: requiere integración Angular y aceptación de la extensión de contrato.
No añade pagos, clases, partidos pendientes, bloqueos excepcionales ni tablas.

La aprobación humana de esta versión quedó registrada con su integración en Desarrollo
mediante la PR #18. La integración visual de UUID reales, estados y `occupiedIntervals`
con Angular requiere coordinación frontend; este TDD no modifica unilateralmente ese
contrato compartido.

Estado: **versión 2 aprobada e integrada mediante PR #18**. La implementación backend
puede avanzar conforme a estos criterios; la integración Angular sigue fuera de alcance.
