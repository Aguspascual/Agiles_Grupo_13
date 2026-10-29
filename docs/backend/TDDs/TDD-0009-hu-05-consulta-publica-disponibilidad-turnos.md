---
id: "0009"
estado: Borrador — pendiente de aprobación humana y coordinación del equipo
version: 1
autor: "Equipo backend"
fecha: "2026-10-29"
titulo: "Consulta pública de disponibilidad de turnos por complejo y fecha"
hu: HU-05
capa: backend
trello: "Pendiente de confirmar la tarjeta HU-05 backend"
---

# TDD-0009: Consulta pública de disponibilidad de turnos

> **Borrador para revisión.** No es un contrato aprobado ni autoriza implementar.
> La asignación de responsable backend y la coordinación con el equipo siguen
> pendientes.

## Contexto de Negocio (PRD)

### Objetivo

Reemplazar los datos de demostración de la grilla pública HU-05 por disponibilidad
calculada desde horarios recurrentes de HU-04 y reservas reales de HU-06. No se
persisten filas para cada turno libre.

### User persona

- **Rol:** persona que consulta un complejo, con o sin sesión.
- **Necesidad:** ver qué turnos de cada cancha están libres, ocupados o cerrados para
  una fecha concreta antes de iniciar una reserva.

### Fuentes y reglas relacionadas

- Contrato propuesto frontend: `docs/contracts/hu-05-grilla-de-turnos.md`.
- RN-07: las fechas y horas se interpretan con `America/Argentina/Buenos_Aires` y el
  reloj del servidor.
- RN-09 y RN-11: la configuración se guarda por día de semana; las franjas no cruzan
  medianoche.
- RN-13: deshabilitar el día impide nuevas reservas, conserva sus franjas y no cancela
  las reservas existentes.
- RN-14: cada día configurado tiene duración de 60 o 90 minutos; cambiarla afecta
  nuevas reservas, no los intervalos reales ya reservados.

## Criterios de aceptación propuestos

- **CA-01 — Consulta pública:** `GET` funciona sin JWT y devuelve un solo complejo y
  una fecha. No depende de una sesión ni expone datos de autenticación.
- **CA-02 — Recursos activos:** un complejo inexistente o con `deleted_at` devuelve
  `404`. La respuesta solo incluye canchas activas; un complejo activo sin canchas
  devuelve `courts: []`.
- **CA-03 — Fecha y zona horaria:** `date` es obligatorio, único y de formato estricto
  `AAAA-MM-DD`. El día, el weekday y sus límites se interpretan en
  `America/Argentina/Buenos_Aires`.
- **CA-04 — Generación recurrente:** para el weekday consultado, generar inicios desde
  cada `opens_at`, avanzando por `duration_minutes` (60 o 90), e incluir solo turnos
  cuyo fin no exceda `closes_at`. Mantener el orden de hora de inicio.
- **CA-05 — Día deshabilitado:** si existe configuración con `enabled=false`, conservar las franjas configuradas y devolver sus intervalos como `BLOCKED`, incluso si una reserva vigente coincide; esto describe que no se admiten nuevas reservas. No borrar, cancelar ni alterar reservas existentes. Si no existe configuración para ese weekday, no generar candidatos libres.
- **CA-06 — Reservas reales:** `status='reserved'` bloquea todo candidato habilitado con solapamiento estricto (`reservation.starts_at < slot.endsAt` y `reservation.ends_at > slot.startsAt`). Una reserva cancelada no bloquea. Usar el inicio y fin persistidos de cada reserva, no reconstruir su duración con la configuración semanal actual. Si una reserva vigente no coincide con ningún candidato recurrente actual, exponer un intervalo reservado derivado de sus horas persistidas; no crear candidatos disponibles alrededor de ella.
- **CA-07 — Estados calculables:** v1 devuelve solo `AVAILABLE`, `RESERVED` y
  `BLOCKED`. `AVAILABLE` significa que el intervalo no se solapa con una reserva
  vigente y que el día está habilitado. El estado no garantiza que una reserva
  concurrente posterior no ocupe el turno; HU-06 valida nuevamente y responde
  conflicto si dejó de estar libre.
- **CA-08 — Turnos pasados:** devolver también los candidatos del día actual que ya
  comenzaron, con `isPast=true`. El instante de inicio menor o igual al reloj del
  servidor se considera pasado. El estado de ocupación se conserva; un turno libre
  pasado puede aparecer como `AVAILABLE` con `isPast=true`.
- **CA-09 — Privacidad:** no incluir identificador de reserva, organizador, nombre,
  teléfono, acompañantes ni avisos. El repositorio de esta consulta no selecciona
  columnas de contacto ni de identidad del reservante.
- **CA-10 — Estabilidad del resultado:** ordenar canchas por `name` y luego UUID, y slots por `startsAt`; construir el ID estable como `courtId:AAAA-MM-DD:HH:MM`.
- **CA-11 — Contrato Angular:** mantener `complex`, `date`, `courts`, `id`, `name`, `covered`, `startsAt`, `endsAt` y `status` del contrato propuesto. Agregar `isPast` para que un adaptador del `SlotGridService` pueda llenar `GridSlot.isPast` sin que el navegador decida una zona horaria distinta. `courtId` se obtiene de la cancha y `date` de la respuesta, sin duplicarlos en cada slot. El adaptador traduce `AVAILABLE/RESERVED/BLOCKED` a `available/reserved/blocked`. Los estados demo `pending` y `class` no se fabrican en backend.
- **CA-12 — Errores:** responder `400` por UUID de complejo inválido, falta/repetición
  de `date`, fecha inexistente o fuera de la ventana acordada; `404` por complejo
  inexistente/inactivo; `500` genérico por fallas internas. Todos los errores usan
  `{"error":"mensaje"}`.
- **CA-13 — Persistencia real:** los casos de reservas y migraciones se prueban contra
  PostgreSQL descartable con `TEST_DATABASE_URL`; ningún test sustituye la persistencia
  por respuestas simuladas.
- **CA-14 — Configuración inconsistente:** validar las franjas leídas con las reglas
  existentes antes de generar slots. Si una configuración persistida tiene intervalos
  solapados u otro estado que no podría producir el servicio HU-04, responder `500`
  genérico y no inventar disponibilidad.

## Diseño técnico propuesto (RFC)

### Modelo de datos

No se requieren migraciones ni tablas nuevas. La consulta combina:

- `complexes.deleted_at` para aceptar solo el complejo activo.
- `courts.deleted_at` y `courts.complex_id` para listar canchas activas del complejo.
- `court_schedule_days.weekday`, `enabled` y `duration_minutes`, junto con
  `court_schedule_intervals.opens_at/closes_at`, para generar los candidatos.
- `reservations.starts_at`, `ends_at` y `status` para calcular ocupación real. Solo
  `reserved` ocupa; `cancelled` no.

Las migraciones 002–005 ya contienen todos los datos necesarios para los tres estados
de v1. La migración 005 no guarda `class`, `pendingMatch`, bloqueos excepcionales por
fecha ni pago pendiente. La migración 004 comprueba que cada intervalo tenga inicio
anterior al fin y limita duraciones, pero no impone en SQL que dos intervalos del mismo
día no se solapen; el validador del servicio HU-04 sí lo rechaza. Por eso la lectura
debe validar cada copia con `schedules.Draft.Validate()` antes de producir estados;
esa misma validación ordena franjas y rechaza datos anómalos sin escribir en PostgreSQL.

### Contrato HTTP

**Endpoint:** `GET /api/v1/complexes/{complexId}/slots?date=AAAA-MM-DD`

- Público; no requiere `Authorization`.
- `complexId` debe ser UUID. `date` es el único parámetro de query y debe aparecer
  exactamente una vez.
- Ventana: desde hoy local inclusive hasta hoy + 13 días inclusive,
  igual a los 14 días que expone la grilla frontend.
- `Cache-Control: no-store`, dado que las reservas pueden cambiar el resultado entre
  consultas.

**Respuesta `200 OK`:** `date` y horas locales, sin incluir datos del reservante.

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
          "id": "c41a0000-0000-4000-8000-000000000001:2026-10-30:18:30",
          "startsAt": "18:30",
          "endsAt": "20:00",
          "status": "AVAILABLE",
          "isPast": false
        },
        {
          "id": "c41a0000-0000-4000-8000-000000000001:2026-10-30:20:00",
          "startsAt": "20:00",
          "endsAt": "21:30",
          "status": "RESERVED",
          "isPast": false
        }
      ]
    }
  ]
}
```

El ID de slot es derivado y estable para la grilla; HU-06 no lo usa como credencial ni
como ID de reserva. Su POST recibe `date` y `startsAt` y verifica nuevamente horario,
complejo/cancha activos, fecha futura y solapamientos en una transacción.

### Consulta SQL y consistencia

1. Validar UUID y fecha en el servicio, usando el reloj del servidor y la ubicación
   `America/Argentina/Buenos_Aires`.
2. Abrir una transacción de solo lectura `REPEATABLE READ` para que complejo, canchas,
   horarios y reservas pertenezcan al mismo snapshot.
3. Leer el complejo por ID con `deleted_at IS NULL`; sin fila, mapear a `404`.
4. Leer las canchas activas con un `LEFT JOIN` al día semanal y sus intervalos,
   filtrando por `complex_id`, weekday y `deleted_at IS NULL`; ordenar por cancha e
   intervalo.
5. Leer, para esas canchas y el intervalo local `[inicioDelDía, inicioDelDíaSiguiente)`,
   las reservas con `status='reserved'` cuyo intervalo se cruza con el día:
   `starts_at < finDelDía AND ends_at > inicioDelDía`. No seleccionar columnas de
   contacto. Los límites se pasan como `time.Time` con la ubicación local.
6. Generar candidatos solo cuando hay configuración recurrente. En día habilitado,
   cualquier solapamiento estricto con una reserva vigente produce `RESERVED`; en día
   deshabilitado, `BLOCKED` tiene prioridad porque expresa admisión de nuevas reservas.
   Usar siempre los timestamps reales y nunca recalcular la duración histórica.
7. Si una reserva vigente no solapa candidato alguno (p. ej., quedó desalineada tras
   cambiar la duración), añadir un intervalo derivado exactamente de sus horas
   persistidas. No es un turno libre inventado. Sin horario, devolver únicamente esas
   reservas vigentes, si las hay; de otro modo `slots: []`. En día deshabilitado, tanto
   las franjas configuradas como reservas fuera de grilla se informan `BLOCKED`, sin
   modificar las filas de reservas.
8. Commit/rollback de la transacción de solo lectura y responder. Una disponibilidad
   `AVAILABLE` es informativa; la reserva posterior vuelve a validar bajo el lock de
   cancha existente en HU-06.

El solapamiento estricto permite que una reserva termine exactamente cuando inicia el
slot siguiente. Si la duración semanal cambia, las reservas existentes mantienen su
intervalo real: una reserva de 90 minutos puede bloquear más de un slot nuevo de 60,
por ejemplo.

### Componentes del monolito modular

- **Servicio HTTP de disponibilidad** (propuesta: paquete nuevo `internal/slots`):
  valida UUID/fecha/ventana, aplica timezone, responde JSON y no instala middleware
  JWT.
- **Repositorio PostgreSQL**: consulta complejo, canchas, horarios y reservas en el
  snapshot de solo lectura; nunca lee datos personales.
- **Rutas**: registrar el GET específico antes de los handlers generales de
  `/api/v1/complexes/`; confirmar que el patrón público no queda detrás del middleware
  de autenticación.
- **Frontend**: fuera de esta HU backend; en una integración posterior, el servicio
  transforma la respuesta a `DayGrid` y mapea `AVAILABLE/RESERVED/BLOCKED` a
  `available/reserved/blocked`.

## Casos de borde y errores

| Escenario | Respuesta |
| --- | --- |
| Falta `date`, se repite o viene una query adicional | `400`, `{"error":"solicitud inválida"}` |
| Formato de fecha inválido, fecha calendario inexistente o fuera de ventana | `400` |
| UUID de complejo inválido, incluido ID demo sintético | `400` |
| Complejo inexistente o dado de baja | `404`, mensaje genérico de no encontrado |
| Cancha dada de baja | Se excluye de `courts` |
| Complejo activo sin canchas activas | `200`, `courts: []` |
| Sin configuración y sin reservas | Cancha con `slots: []`; no se inventan turnos |
| Día deshabilitado con franjas conservadas | Los intervalos configurados se devuelven como `BLOCKED`; reservas intactas en PostgreSQL |
| Reserva `cancelled` | No ocupa el turno |
| Reserva `reserved` que cruza el inicio o fin del slot | `RESERVED` por solapamiento real; si queda fuera de grilla se expone el intervalo persistido |
| Reserva vigente en día deshabilitado | `BLOCKED` en la respuesta; reserva conservada intacta en PostgreSQL |
| Error de PostgreSQL | `500`, sin detalles internos |

## Pruebas propuestas

### Unitarias

- Parseo estricto de fechas, fechas de calendario inválidas y límites de 14 días en la
  zona horaria de Argentina.
- Generación para duraciones de 60 y 90 minutos, una o varias franjas, último slot que
  cabe exactamente y tiempo sobrante menor a una duración.
- Día inexistente, día deshabilitado y fecha/hora de inicio exactamente igual al reloj.
- Solapamientos parciales y límites adyacentes; reservas históricas tras cambios 60↔90 y 90↔60; comprobar que ningún candidato solapado queda `AVAILABLE`, que una reserva fuera de grilla se representa con sus timestamps persistidos y que una cancelada no ocupa.
  un cambio de configuración; reserva cancelada.
- Prioridad `BLOCKED` en día deshabilitado; en día habilitado, `RESERVED > AVAILABLE` por solapamiento.
- Sin configuración recurrente: cero slots generados; solo intervalos reales de reservas vigentes, si existen.

### HTTP

- GET sin JWT; formato compatible, arrays vacíos, orden por nombre y UUID, y rechazo del ID demo sintético.
- 400 para parámetros/fechas/UUID inválidos; 404 para complejo inexistente o inactivo;
  500 para fallo de repositorio.
- Comprobar que la respuesta no contiene contacto, organizador, acompañantes ni IDs de
  reserva.
- Verificar `isPast` para un slot iniciado sin usar el reloj real del test.

### PostgreSQL real

- Usar `TEST_DATABASE_URL` solo contra una base descartable `padelmatch_test`; ejecutar
  las migraciones existentes 002–005 en un esquema aislado y eliminarlo al finalizar.
- Crear complejo/canchas activos e inactivos y configuraciones de weekday para
  duraciones de 60/90, múltiples intervalos y `enabled=false`.
- Crear reservas vigentes reales con HU-06 y casos controlados cancelados/históricos. Verificar solapamiento, cambios 60↔90, reservas fuera de grilla y día deshabilitado; confirmar que `BLOCKED` no cancela reservas y que no hay `AVAILABLE` solapado. Comprobar GET público, recursos dados de baja, UUID real, orden y privacidad.
- Insertar por SQL dos franjas solapadas que HU-04 no produciría, guardar snapshot de configuración y reservas, consultar y exigir fallo cerrado `500`; comparar antes/después para demostrar que la validación no escribe en PostgreSQL.
  engañosos ni escrituras.
- Comprobar que el GET no cambia horarios/reservas y que un `AVAILABLE` deja de ser
  reservable si HU-06 detecta una reserva concurrente; no asumir que una lectura
  pública reserva o bloquea el turno.
- Ejecutar desde `backend/`: `go test -count=1 ./...` y `go vet ./...`; declarar toda
  prueba PostgreSQL omitida y el motivo.

## Decisiones propuestas para v1 y pendientes de aprobación

Se incorporan como diseño propuesto las decisiones solicitadas para esta versión:

- Ventana local desde hoy hasta hoy + 13 días inclusive, en
  `America/Argentina/Buenos_Aires`.
- Solo `AVAILABLE`, `RESERVED` y `BLOCKED`; no simular partidos pendientes, clases ni
  bloqueos excepcionales sin persistencia.
- Día recurrente deshabilitado: informar `BLOCKED` en intervalos configurados aun si
  coincide una reserva; conservar íntegra la reserva en PostgreSQL. El estado describe
  si se admiten nuevas reservas, no si existe una reserva histórica.
- Orden estable de canchas por nombre y luego UUID.
- Sin horario recurrente no generar candidatos libres; exponer solo reservas vigentes
  persistidas que haya en esa fecha.
- No devolver datos personales ni de contacto del reservante.

Puntos que requieren aprobación/coordinación antes de implementar:

1. **Aprobar formalmente este TDD y asignar responsable/reviewer**, incluida la tarjeta
   HU-05 backend. Las decisiones anteriores siguen propuestas hasta esa aprobación.
2. **Resolver la integración de IDs frontend:** `ComplexPreviewStore` usa IDs sintéticos
   como `complex-cumbre`; backend requiere el UUID real del complejo persistido. No
   mapear esos IDs en backend. El frontend deberá obtener el UUID real del catálogo o
   coordinar el reemplazo de datos demo, sin alterar aquí su contrato.
3. **Aprobar la representación de reservas fuera de grilla** definida en CA-06: si
   ninguna franja actual se solapa con una reserva vigente, exponer una fila de sus horas
   reales como `RESERVED` (o `BLOCKED` si el día está deshabilitado). Si el contrato
   visual no admite duración arbitraria, acordar la adaptación antes de integrar; no
   recortar ni mover la reserva para forzarla a una celda.
4. **Confirmar tratamiento de filas que crucen medianoche**, si existen: HU-06 no las
   crea, pero la tabla permite timestamps cuyo fin cae al día siguiente. Decidir si se
   expone solo la porción del día o se falla cerrado ante esos datos.

## Alcance y estado

No agrega esquema, reservas, pagos, clases, partidos abiertos, bloqueos por fecha ni
modificaciones de frontend. No modifica la rama ni el PR de HU-08. Estado: **borrador
pendiente de aprobación humana y confirmación de asignación**. No implementar hasta
cerrar los puntos pendientes y confirmar la asignación con el equipo.
