---
id: "0010"
estado: "Borrador v3 para aprobación humana; la aprobación ocurre en la revisión de la PR"
version: 3
autor: "Equipo backend"
fecha: "2026-10-30"
titulo: "Cancelación de una reserva"
hu: HU-14
capa: backend
trello: "https://trello.com/c/kWBU1esU"
---

# TDD-0010: Cancelación de una reserva

> **Borrador v3 para aprobación humana (en la revisión de la PR).** La v3 corrige el orden de
> locks (complejo → cancha → reserva) y exige reserva web con organizador real (`origin='web'`).
> En la v2, Pedro Moyano confirmó en su comentario de la
> [PR #19](https://github.com/Aguspascual/Agiles_Grupo_13/pull/19#issuecomment-6500389121)
> que el límite inclusivo de cuatro horas es correcto según RN-02. Solicitó aclarar el
> alcance de grupo completo, la agenda y los avisos a participantes. Esas precisiones se
> documentan aquí para su revisión; no implican que el TDD esté aprobado ni que haya
> implementación funcional.

## Contexto de negocio

### Objetivo

Permitir que el organizador cancele su reserva vigente dentro del plazo acordado,
liberando el turno y dejando un aviso interno, con una única transición atómica e
idempotente. La fila se conserva como `cancelled`; no se borra ni se modifica el horario.

### Alcance de esta entrega

Esta versión cubre exclusivamente la cancelación de reservas de grupo completo creadas
por HU-06, donde la reserva ocupa tres acompañantes además del organizador. El actor
propuesto como único autorizado para cancelar es el organizador autenticado. La agenda de
reservas queda pendiente. También quedan pendientes los avisos individuales a
participantes de partidos abiertos.

Los tres acompañantes de una reserva de grupo completo no tienen cuenta ni identidad
individual persistida según RN-04; por eso, el aviso interno propuesto en esta versión se
dirige únicamente al organizador. La cancelación de partidos abiertos, la baja de
participantes y los avisos correspondientes quedan fuera del alcance de HU-14 v1.

### Persona

- **Rol propuesto:** jugador que organizó la reserva.
- **Necesidad:** cancelar una reserva que ya no utilizará y confirmar el estado final.

### Reglas relacionadas

- **RN-02:** cancelar si faltan al menos cuatro horas para el inicio, incluido el
  instante exacto del límite.
- **RN-07:** usar el reloj del servidor; las horas se representan en
  `America/Argentina/Buenos_Aires`.
- **RN-08:** cambio persistente y liberación atómicos; repetir no duplica cambios ni
  avisos.
- **RN-04:** los tres acompañantes no tienen cuenta ni identidad individual persistida.

## Criterios de aceptación propuestos

CA-02, el límite inclusivo de cuatro horas, fue confirmado por Pedro Moyano según RN-02.
Las demás decisiones propuestas siguen pendientes de aprobación del equipo:

- **CA-01 — Actor:** solo el organizador autenticado puede cancelar su reserva, y solo si
  es una reserva web (`origin='web'` con `organizer_id` real, CA-09 de TDD-0012). Las
  reservas manuales no tienen organizador: por este endpoint responden `404`. Los
  encargados y administradores cancelan por el endpoint propio de
  [TDD-0016](TDD-0016-hu-07-cancelacion-por-encargado.md) (contrato C2). El actor se toma
  del JWT; no se acepta `userId` en request, query o ruta.
- **CA-02 — Plazo:** una reserva `reserved` puede cancelarse si `now <= starts_at - 4h`.
  Comparar instantes del reloj del servidor sin redondear; el límite exacto está incluido.
- **CA-03 — Fuera de plazo:** si faltan menos de cuatro horas, responder `409 Conflict`
  y no modificar ninguna fila ni aviso en PostgreSQL.
- **CA-04 — Idempotencia:** si la reserva ya está `cancelled`, su organizador puede
  repetir la solicitud, incluso después del límite. Responder `200` sin nueva transición
  ni aviso.
- **CA-05 — Ocultamiento de recursos ajenos:** reserva inexistente o perteneciente a
  otro usuario responde `404`, sin revelar si existe.
- **CA-06 — Persistencia:** cambiar `reserved` a `cancelled` en la fila existente,
  conservando ID, organizador, cancha, inicio/fin y datos almacenados; no borrar
  físicamente ni recrear la reserva.
- **CA-07 — Liberación:** la reserva cancelada deja de ocupar el intervalo porque las
  consultas de solapamiento usan únicamente `status='reserved'`. No cambiar el código ni
  el contrato de alta de HU-06.
- **CA-08 — Aviso interno:** registrar exactamente un aviso `reservation_cancelled`
  para el organizador en la misma transacción que el cambio de estado. No crear
  identidades para acompañantes ni enviar email, WhatsApp u otras notificaciones externas.
- **CA-09 — Atomicidad y concurrencia:** si falla la actualización o el aviso, revertir
  toda la transacción. Dos cancelaciones simultáneas generan una transición y un aviso;
  una cancelación concurrente con un alta no puede dejar dos reservas activas
  superpuestas.
- **CA-10 — Confirmación:** la respuesta de cancelación incluye estado `cancelled` para
  confirmarlo inmediatamente. El GET actual de reservas propias sigue listando solo
  `reserved`; no se agrega historial ni se modifica HU-06.

## Diseño técnico propuesto

### Modelo de datos y migración

La tabla `reservations` ya permite `reserved` y `cancelled`. El alta existente comprueba
solapamientos solo contra filas `reserved`; por ello, una vez confirmado el UPDATE, el
intervalo queda libre para una nueva reserva. No modificar `005_reservations.sql` ni
agregar columnas a `reservations`.

`reservation_notices.kind` actualmente permite solo `reservation_confirmed`. Proponer
una migración nueva y aditiva `006_reservation_cancellation_notice.sql` que reemplace su
CHECK por uno que admita ambos tipos:

```sql
ALTER TABLE reservation_notices
    DROP CONSTRAINT reservation_notices_kind_check;

ALTER TABLE reservation_notices
    ADD CONSTRAINT reservation_notices_kind_check
    CHECK (kind IN ('reservation_confirmed', 'reservation_cancelled'));
```

Conservar el unique actual `(reservation_id, kind)`, que aporta una segunda barrera
contra avisos duplicados. La migración no cambia ni elimina avisos `reservation_confirmed`.
La inserción usa `user_id = organizer_id`; el payload no incluye contacto y sigue la
forma de `reservation` documentada en TDD-0008 v2, con `status: "cancelled"`. La lista de
avisos existente podrá incluir el nuevo `type`, conservando la forma del JSON, una vez
aprobada e implementada su extensión.

### Contrato HTTP

- **Endpoint propuesto (contrato C3):** `POST /api/v1/reservations/{reservationId}/cancel`.
  El consumo en pantalla ("Mis reservas") queda para HU-17; esta entrega solo agrega el
  servicio HTTP del frontend.
- **Autenticación:** `Authorization: Bearer <JWT>`.
- **Path:** UUID de la reserva; solo el organizador autenticado puede usarlo.
- **Request:** sin body ni query string.
- **Primera cancelación e idempotent retry:** `200 OK` con el estado final en ambos casos.
- **Headers:** `Cache-Control: no-store`.

```json
{
  "reservation": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "cancelled",
    "complex": { "id": "6ba7b810-9dad-41d1-80b4-00c04fd430c8", "name": "Complejo Norte" },
    "court": { "id": "6ba7b811-9dad-41d1-80b4-00c04fd430c8", "name": "Cancha 1" },
    "date": "2026-11-03",
    "startsAt": "18:00",
    "endsAt": "19:30",
    "timeZone": "America/Argentina/Buenos_Aires"
  }
}
```

No se devuelven nombre ni teléfono de contacto. Los errores conservan el formato
existente `{"error":"mensaje"}`:

| Escenario | HTTP |
| --- | --- |
| UUID inválido o body/query inesperados | `400 Bad Request` |
| JWT faltante, inválido o usuario inexistente | `401 Unauthorized` |
| Reserva inexistente o no organizada por el actor | `404 Not Found` |
| Reserva vigente fuera del límite de cuatro horas | `409 Conflict` |
| Fallo interno o de PostgreSQL | `500 Internal Server Error` |

La propiedad se comprueba antes de devolver un estado, incluido el idempotente. La
repetición de una cancelación propia ya completada responde `200` aun si venció el plazo.

### Transacción, bloqueos y concurrencia

Todo escritor de reservas toma los locks en el orden único
`complejo FOR SHARE → cancha FOR UPDATE → reserva FOR UPDATE` (el alta de HU-06/HU-15 ya
lo hace). La cancelación usa ese mismo orden para serializar cambios de ocupación, y
comparte el núcleo `cancel(...)` con TDD-0016 (v2 de este TDD omitía el lock del complejo):

1. Validar JWT y UUID; iniciar una transacción.
2. Leer inicialmente `complex_id` y `court_id` de la reserva por UUID, sin bloquear. Si
   no existe, responder `404`. Esta lectura no cambia datos ni revela el recurso.
3. Bloquear el complejo con `SELECT ... FOR SHARE` y luego la cancha con
   `SELECT ... FOR UPDATE`, sin exigir que estén activos: una baja lógica del recurso no
   debe impedir al organizador cancelar una reserva histórica.
4. Volver a leer/bloquear la reserva con `SELECT ... FOR UPDATE`; verificar que
   `origin='web'` y que su `organizer_id` coincide con el actor. Si no, rollback y `404`.
5. Si ya está `cancelled`, no escribir nada y completar la transacción para devolver el
   resultado idempotente `200`; no insertar otro aviso.
6. Si está `reserved`, capturar la hora del servidor después de obtener el lock. Comparar
   el instante íntegro con `starts_at - 4 horas`. Si `now` es posterior, rollback y `409`
   sin escrituras.
7. Actualizar con SQL parametrizado y condición `status='reserved'`. Insertar un único
   aviso `reservation_cancelled` dirigido al organizador. Confirmar ambos cambios en la
   misma transacción; cualquier error antes del commit revierte ambos.

La creación y cancelación se serializan en la fila de cancha. Si el alta obtiene primero
el lock, ve la reserva aún activa y rechaza el solapamiento; luego la cancelación puede
liberarla. Si la cancelación obtiene primero el lock, confirma el estado `cancelled` y el
alta posterior puede ocupar el intervalo. En ninguno de los órdenes quedan dos reservas
activas superpuestas. Dos cancelaciones también se serializan; la segunda ve el estado
`cancelled` y no repite el UPDATE ni el aviso.

### Componentes

- **Servicio HTTP:** validar entrada/autenticación, resolver actor y mapear estados a
  `400`, `401`, `404`, `409` o `500`.
- **Repositorio:** locks, verificación de ownership, comparación temporal, UPDATE e
  INSERT parametrizados en una transacción PostgreSQL.
- **Rutas:** agregar solo la ruta nueva protegida por el middleware JWT existente.
- **Migración 006:** ampliar el CHECK de avisos, conservando `reservation_confirmed` y
  la unicidad existente.

## Casos de borde y errores

| Caso | Resultado esperado |
| --- | --- |
| `now == starts_at - 4h` | Cancelar; `200` |
| `now` un nanosegundo posterior al límite | Sin escrituras; `409` |
| Reserva ya cancelada, antes o después del límite | Repetición; `200`, cero efectos nuevos |
| Otra cuenta intenta cancelar | `404`; reserva y avisos intactos |
| Aviso falla al persistir | Rollback del cambio de estado; `500` |
| Nueva alta compite con cancelación | Serialización por lock de cancha; no hay dos filas activas solapadas |
| Reintentos concurrentes de cancelación | Un cambio y un aviso; respuestas idempotentes `200` |
| Recurso lógico inactivo con reserva existente | El organizador todavía puede cancelar la fila |

## Pruebas propuestas

### Unitarias

- Límite exacto incluido; nanosegundo/segundo posterior rechazado; instante anterior
  aceptado. Reloj inyectable y comparación sin redondeo.
- Estado `cancelled` idempotente tras el plazo; UUID y entradas inválidas.
- Serialización de inicio/fin local en `America/Argentina/Buenos_Aires`.

### HTTP

- Sin JWT, JWT inválido, usuario inexistente y cancelación ajena (`401`/`404`).
- Organizador cancela dentro del límite (`200`) y obtiene la respuesta `cancelled`; la
  respuesta no incluye contacto.
- Exactamente cuatro horas (`200`), menos de cuatro horas (`409`) y comprobación de que
  el caso `409` no escribe en PostgreSQL.
- Reintento propio después del plazo (`200`) sin segundo aviso.
- Comprobar que el GET de reservas propias no lista la fila cancelada y que la respuesta
  de cancelación permite confirmar el estado sin modificar ese GET.
- Rechazo de body/query inesperados y `Cache-Control: no-store`.

### PostgreSQL real

- Aplicar migraciones 001–006 en una base descartable; comprobar que 006 conserva avisos
  confirmados y acepta `reservation_cancelled` sin modificar 005.
- Crear una reserva real mediante HU-06; cancelar por HTTP; confirmar `status='cancelled'`,
  una sola fila de aviso para el organizador y ausencia de contacto en el payload.
- Repetir y ejecutar dos cancelaciones concurrentes; confirmar una transición y un aviso.
- Inyectar fallo al insertar el aviso; confirmar que el estado sigue `reserved` y que no
  existe aviso parcial.
- Intentar cancelar luego del límite y comparar estado/avisos antes y después: cero
  escrituras.
- Cancelar y crear otra reserva en el mismo intervalo; confirmar que la anterior está
  `cancelled`, la nueva `reserved` y no hay dos reservas `reserved` solapadas.
- Sincronizar cancelación y nueva alta concurrentes; verificar ambos órdenes y ausencia
  de solapamientos activos.
- Ejecutar desde `backend/`: `go test -count=1 ./...` y `go vet ./...`; declarar las
  pruebas PostgreSQL omitidas y el motivo.

## Decisiones propuestas pendientes de aceptación humana

CA-02 está confirmada por Pedro Moyano: RN-02 permite cancelar hasta cuatro horas antes
del inicio, incluyendo el instante exacto. CA-01 y CA-03 a CA-10 siguen siendo decisiones
propuestas para v1, no acuerdos históricos, y requieren aprobación del equipo. El alcance
de grupo completo, agenda y avisos a participantes se explicitó a partir de su comentario
en la PR #19 y queda sujeto a su revisión final del TDD. Antes de implementar se debe
además:

1. Confirmar que el TDD refleja los criterios vigentes de la tarjeta HU-14. Su contenido
   no estuvo accesible desde esta sesión.
2. Confirmar responsable/reviewer y coordinación de la tarjeta, como requieren los
   acuerdos backend.
3. Aprobar la extensión documental de TDD-0008 para que
   `GET /api/v1/reservation-notices` admita `reservation_cancelled`, su futura migración
   aditiva 006 y la adaptación frontend. No se implementa aquí.

## Compatibilidad y contradicciones con reglas/documentos actuales

- Pedro confirmó que el umbral exacto e inclusivo de cuatro horas coincide con RN-02. El
  uso del reloj del servidor y la zona de La Plata siguen RN-07; no se propone modificar
  reglas compartidas.
- La transición `reserved` → `cancelled`, su atomicidad y la idempotencia son coherentes
  con RN-08 y con los estados ya admitidos por la migración 005.
- RN-08 menciona avisos a “los afectados”. Esta propuesta puede avisar solo al
  organizador porque RN-04 y el esquema no asignan identidad a los tres acompañantes. Si
  RN-08 exige avisar individualmente a todos, la persistencia actual no basta; el equipo
  debe aprobar que el aviso de esta entrega se limite al organizador. Los avisos a
  participantes de partidos abiertos corresponden a otras funcionalidades pendientes.
- La consulta de avisos de HU-06 hoy expone `type` como string y payload JSON; al agregar
  el nuevo tipo cambia el conjunto de valores observable. El cambio requiere coordinación
  y aprobación de compatibilidad, aunque no altera la forma de respuesta ni edita el
  contrato existente en este TDD.
- El GET de reservas propias filtra `status='reserved'`; tras cancelar, la fila deja de
  aparecer. La respuesta `200` de esta operación confirma el estado. Historial queda fuera.

## Alcance y estimación

Operación backend independiente; no modifica código funcional de HU-06 ni HU-05/HU-08,
no crea identidades para acompañantes y no envía notificaciones externas. La migración 006
es necesaria para el aviso interno propuesto; no se toca 005.

**Complejidad técnica: media.** La transición y los estados ya existen; falta endpoint,
ownership, comparación temporal, lock compartido, migración del tipo de aviso, atomicidad
y pruebas concurrentes PostgreSQL. Estimación: **1–2 jornadas backend desde la
aprobación**, más revisión e integración. Puede entrar antes de la entrega si los puntos
pendientes se cierran pronto. La integración visual queda aparte.

Estado: **borrador v3 para aprobación humana**. RN-02 está confirmada por Pedro; CA-01 y
CA-03 a CA-10 y el alcance documentado se aprueban en la revisión de la PR que lo
implementa. Toda decisión ambigua se registró en "Pendiente o dependencias" de esa PR.
