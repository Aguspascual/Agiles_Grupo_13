---
id: "0010"
estado: "Borrador; decisiones propuestas pendientes de aceptación del equipo"
version: 1
autor: "Equipo backend"
fecha: "2026-10-29"
titulo: "Cancelación de una reserva"
hu: HU-14
capa: backend
trello: "https://trello.com/c/kWBU1esU"
---

# TDD-0010: Cancelación de una reserva

> **Borrador para revisión humana.** Las decisiones de esta versión fueron propuestas
> por el usuario para cerrar el diseño; no son acuerdos históricos ni autorizan a
> implementar. La tarjeta de Trello de HU-14 no pudo consultarse desde esta sesión. El
> alcance conocido se basa en RN-02, RN-07, RN-08 y el esquema de `origin/Desarrollo`.

## Contexto de negocio

### Objetivo

Permitir que el organizador cancele su reserva vigente dentro del plazo acordado,
liberando el turno y dejando un aviso interno, con una única transición atómica e
idempotente. La fila se conserva como `cancelled`; no se borra ni se modifica el horario.

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

Las siguientes diez decisiones son propuestas pendientes de aprobación del equipo:

- **CA-01 — Actor:** solo el organizador autenticado puede cancelar su reserva. No hay
  excepciones para encargados ni administradores en v1. El actor se toma del JWT; no se
  acepta `userId` en request, query o ruta.
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
La inserción usa `user_id = organizer_id`; el payload no incluye contacto. La lista de
avisos existente podrá incluir el nuevo `type`, conservando la forma del JSON.

### Contrato HTTP

- **Endpoint propuesto:** `POST /api/v1/reservations/{reservationId}/cancel`.
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

El alta existente de HU-06 bloquea la fila de cancha con `FOR UPDATE` antes de consultar
reservas e insertar. La cancelación debe usar ese mismo lock para serializar cambios de
ocupación en la cancha:

1. Validar JWT y UUID; iniciar una transacción.
2. Leer inicialmente el `court_id` de la reserva por UUID. Si no existe, responder
   `404`. Esta lectura no cambia datos ni revela el recurso en la respuesta.
3. Bloquear la cancha existente con `SELECT ... FOR UPDATE`, sin exigir que esté activa:
   una baja lógica del recurso no debe impedir al organizador cancelar una reserva
   histórica.
4. Volver a leer/bloquear la reserva con `SELECT ... FOR UPDATE`; verificar que su
   `organizer_id` coincide con el actor. Si no coincide, rollback y `404`.
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

Las diez decisiones de CA-01 a CA-10 son propuestas explícitas para v1 y requieren
aceptación del equipo. No se presentan como decisiones históricas. Antes de implementar
se debe además:

1. Confirmar que el TDD refleja los criterios vigentes de la tarjeta HU-14. Su contenido
   no estuvo accesible desde esta sesión.
2. Confirmar responsable/reviewer y coordinación de la tarjeta, como requieren los
   acuerdos backend.
3. Confirmar que `GET /api/v1/reservation-notices` puede incluir un nuevo valor
   `reservation_cancelled`. Es una extensión del conjunto de valores de HU-06/TDD-0008,
   aunque conserva la estructura JSON; coordinar el consumidor frontend para valores
   desconocidos. Si no se acepta, definir cómo se consulta el aviso interno sin ampliar
   ese contrato.

## Compatibilidad y contradicciones con reglas/documentos actuales

- El umbral exacto de cuatro horas y el reloj del servidor coinciden con RN-02 y RN-07;
  no se propone modificar reglas compartidas.
- La transición `reserved` → `cancelled`, su atomicidad y la idempotencia son coherentes
  con RN-08 y con los estados ya admitidos por la migración 005.
- RN-08 menciona avisos a “los afectados”. Esta propuesta puede avisar solo al
  organizador porque RN-04 y el esquema no asignan identidad a los tres acompañantes. Si
  RN-08 exige avisar individualmente a todos, la persistencia actual no basta; el equipo
  debe aceptar el alcance organizador-only o diseñar otra funcionalidad de identidades.
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

Estado: **borrador pendiente de aprobación humana y confirmación de asignación**. No
implementar antes de cerrar las decisiones.
