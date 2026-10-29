---
autor: "Equipo backend"
fecha: "2026-10-29"
titulo: "Alta de una reserva manual"
estado: "Borrador v1 para aprobación humana"
version: 1
hu: HU-15
trello: "https://trello.com/c/H3L4wVmS"
---

# TDD-0012: Alta de una reserva manual

**Propuesta pendiente de aprobación.** Un encargado registra el contacto de un cliente
sin cuenta y ocupa un turno usando la misma reserva y protección transaccional que la web.
Esta entrega contiene documentación, no implementación ni evidencia funcional.

## Contexto de Negocio (PRD)

### Objetivo

La [tarjeta HU-15](https://trello.com/c/H3L4wVmS) solicita:

> Como encargado de complejo, quiero cargar las reservas que me llegan por teléfono o WhatsApp para que la grilla refleje la ocupación real.
>
> - Puedo marcar un turno como Reservado indicando nombre y teléfono del cliente.
> - Esa reserva se ve en la grilla igual que las hechas desde la web.

Se documenta únicamente el **alta manual**. Edición, cancelación, agenda, participantes,
pagos, notificaciones externas, frontend y Docker quedan fuera. No se crea una cuenta
para el cliente ni se identifica al empleado como jugador u organizador.

### User Persona

- **Nombre**: encargado asignado al complejo; también administrador general.
- **Necesidad**: registrar una reserva recibida fuera de la web sin duplicar la ocupación.

### Criterios de Aceptación

| ID | Resultado verificable |
| --- | --- |
| CA-01 | Un encargado del complejo o administrador general autenticado crea la reserva con nombre y teléfono y recibe `201`; un encargado ajeno o jugador no puede hacerlo. |
| CA-02 | Solo se aceptan turnos estrictamente futuros, alineados con una franja habilitada y completos dentro de ella, según la configuración vigente y RN-07, RN-11, RN-13 y RN-14. |
| CA-03 | Se persisten contacto, origen manual, registrante real e intervalo definitivo en `reservations`, sin organizador ni acompañantes ficticios. |
| CA-04 | Validación, autorización, ocupación e inserción se resuelven sin escrituras parciales; ante carreras manual/manual o manual/web, solo una reserva ocupa el intervalo. |
| CA-05 | HU-05 representa la ocupación como `RESERVED`, sin exponer contacto ni identidades, también si luego se deshabilita el día o el intervalo queda fuera de la nueva grilla. |
| CA-06 | Baja de cancha y cambios de horarios aplican las protecciones HU-03/04 a reservas manuales y web por igual; no alteran sus intervalos originales. |
| CA-07 | Reservas, respuestas, consultas propias y avisos web de HU-06 conservan su contrato. La manual no aparece como reserva personal del registrante ni genera avisos para el cliente sin cuenta o para el empleado como supuesto organizador. |
| CA-08 | Una migración nueva preserva registros web, contactos, estados, relaciones y avisos anteriores; el modelo permite distinguirlos sin reescribir migraciones aplicadas. |
| CA-09 | HU-14 conserva su alcance exclusivo de organizadores de reservas web HU-06; no obtiene permisos implícitos sobre reservas manuales. |

## Diseño Técnico (RFC)

### Modelo de Datos

**Situación verificada:** [005_reservations.sql](../../../backend/migrations/005_reservations.sql)
exige `organizer_id NOT NULL` y `companions = 3`. Ya guarda `contact_name` y
`contact_phone`. Su índice parcial `reservations_active_court_interval_idx` incluye
las filas `status = 'reserved'`; **no es una restricción única** ni sustituye el bloqueo.

Propuesta de migración compatible, sobre la misma tabla:

| Campo | Reserva web existente/nueva | Reserva manual |
| --- | --- | --- |
| `origin TEXT NOT NULL` | `web` | `manual`, determinado por el servidor |
| `registered_by UUID NOT NULL REFERENCES users(id)` | Organizador real | Encargado o administrador autenticado |
| `organizer_id UUID REFERENCES users(id)` | Obligatorio, sin cambiar su significado | `NULL` |
| `companions SMALLINT` | `3`, como HU-06 | `NULL`: cantidad no informada, no tres acompañantes inventados |
| `contact_name`, `contact_phone` | Se conservan íntegros | Contacto suministrado y normalizado |
| `starts_at`, `ends_at`, `status` | Sin alteraciones | Intervalo calculado y `reserved` |

La ausencia de acompañantes en manual no significa cero jugadores: la reserva ocupa
la cancha completa, independientemente del modelo de participantes. No se agregan filas
de usuarios ni perfiles. El contacto no se resuelve ni vincula automáticamente a cuentas
existentes por nombre o teléfono.

Secuencia propuesta para la futura migración versionada:

1. Agregar `origin` con valor predeterminado `web` y `registered_by` inicialmente nullable.
2. Completar filas previas con `origin = 'web'` y `registered_by = organizer_id`;
   conservar IDs, organizadores, contactos, acompañantes, intervalos, estados y avisos.
3. Exigir `registered_by NOT NULL`, su FK y `origin IN ('web', 'manual')`.
   Quitar únicamente el `NOT NULL` de organizador/acompañantes y el CHECK incondicional
   de `companions = 3`, reemplazándolo por restricciones condicionales explícitas:
   - Web: `organizer_id IS NOT NULL`, `companions IS NOT NULL AND companions = 3`
     y `registered_by = organizer_id`.
   - Manual: `organizer_id IS NULL AND companions IS NULL`.
   Los predicados `IS NOT NULL` son necesarios: un CHECK SQL que resulte NULL no rechaza.
4. Adaptar la escritura web para registrar `registered_by` explícitamente sin cambiar
   su request/response ni sus avisos; aplicar migración y despliegue de forma coordinada,
   sin mantener una versión antigua escribiendo contra la nueva columna obligatoria.
5. Mantener el índice de ocupación, FKs existentes y estados `reserved/cancelled`.
   No copiar reservas a otra tabla, borrar registros ni reescribir `001`–`005`.

El número y nombre de archivo se acuerdan **con Seba antes de implementar**:
[TDD-0010](TDD-0010-hu-14-cancelacion-reserva.md) propone `006` para avisos de cancelación,
pero eso no significa que esté aplicada. Usar el siguiente número libre tras integrar
dependencias y revisar migraciones locales; no reservar aquí `006` ni `007` a ciegas.
Probar la actualización desde datos reales de prueba anteriores, no solo esquema vacío.
No ofrecer rollback destructivo mientras existan reservas manuales.

### Contrato de API

- **Endpoint**: `POST /api/v1/complexes/{complexId}/courts/{courtId}/manual-reservations`
- **Autenticación**: `Authorization: Bearer <JWT>` mediante HU-01.
- **Permisos**: encargado asignado al complejo y administrador general sin necesidad
  de asignación, reutilizando la política administrativa de complejos/horarios.
  El permiso nunca se deduce de campos del cliente ni del rol de demostración frontend.
- **Request Body**:

```json
{
  "date": "2026-11-02",
  "startsAt": "18:00",
  "contact": {
    "name": "Cliente de ejemplo",
    "phone": "+54 221 555 0100"
  }
}
```

Fecha local estricta `YYYY-MM-DD`, hora `HH:mm`, zona
`America/Argentina/Buenos_Aires`. Reutilizar validación de HU-06: trim de nombre y
teléfono, ambos no vacíos; no introducir formato E.164 obligatorio ni nuevas reglas
de teléfono en el código compartido. Rechazar JSON inválido, tipos incorrectos,
campos desconocidos, obligatorios ausentes, UUID inválidos y query parameters.
No aceptar `duration`, `endsAt`, `status`, `origin`, `registeredBy`, `organizerId`
ni `companions`: todos son responsabilidad del servidor o no aplican.

**Response `201 Created`**, siguiendo la envoltura y forma de reserva de HU-06:

```json
{
  "reservation": {
    "id": "950fa7d9-7634-4bb0-9f24-7e3fb809df10",
    "status": "reserved",
    "complex": {
      "id": "e70b878c-a4ef-4089-8c09-f9ea6d78b201",
      "name": "Complejo de ejemplo"
    },
    "court": {
      "id": "2a2d99eb-faa9-40e9-9cf2-360c124fd122",
      "name": "Cancha 1"
    },
    "date": "2026-11-02",
    "startsAt": "18:00",
    "endsAt": "19:30",
    "timeZone": "America/Argentina/Buenos_Aires"
  }
}
```

Ejemplo suponiendo reloj anterior al inicio y una franja habilitada con duración de
90 minutos. La respuesta no expone contacto ni identidad del registrante: su persistencia
se demuestra en las pruebas de integración, sin inventar un endpoint de agenda/consulta.
Usar `Content-Type: application/json` y `Cache-Control: no-store`.
El estado persistido/administrativo `reserved` se proyecta públicamente como `RESERVED`.

### Componentes del Monolito Modular

- **Modelo**: reutilizar `Request`, `Contact`, validación temporal y
  `slotWithinSchedule` de `backend/internal/reservations/model.go`; distinguir origen
  y registrante en persistencia sin cambiar los DTO web.
- **Servicio HTTP**: nueva ruta en el módulo de reservas y composición de `cmd/api`,
  reutilizando autenticación, decodificación estricta y errores. No duplicar la lógica
  de alta por endpoint ni relajar permisos del alta web.
- **Repositorio**: extraer/reutilizar una operación común de validación y ocupación
  transaccional para ambos orígenes. Separar efectos específicos: web conserva aviso
  `reservation_confirmed`; manual no inserta `reservation_notices`.

### Autorización, transacción y concurrencia

1. Validar JWT y sintaxis; obtener identidad del contexto autenticado, nunca del body.
2. Abrir transacción. Bloquear complejo activo con `FOR SHARE` y luego cancha activa
   perteneciente a ese complejo con `FOR UPDATE`, **igual que los escritores actuales**.
3. Comprobar dentro de la transacción rol y asignación administrativa vigentes usando
   la política existente; mantener su protección frente a cambios de asignación.
   No autorizar solo antes de la transacción ni agregar un orden inverso de bloqueos.
4. Tras esperar los locks, volver a comprobar inicio estrictamente posterior al reloj
   del servidor, configuración del día habilitada, duración 60/90, alineación con el
   inicio de franja y fin dentro de ella. No confiar en una disponibilidad previa.
5. Comprobar ocupación por intervalos reales semiabiertos `[starts_at, ends_at)` en
   `reservations`, sin filtrar por origen: `starts_at < nuevo_fin AND ends_at > nuevo_inicio`
   para `status = 'reserved'`. Dos turnos adyacentes no se solapan.
6. Insertar una sola reserva con origen manual y contacto; commit antes de `201`.
   Cualquier error revierte todo. Consultas parametrizadas y contextos con cancelación;
   un fallo de base no se interpreta como disponibilidad libre.

La misma exclusión debe regir las carreras con alta web, baja de cancha y modificación
o baja de horario. Si gana la modificación, el alta revalida la nueva configuración;
si gana el alta, la modificación incompatible responde `409` y conserva ambos datos.
Deshabilitar o cambiar duración no cancela ni recalcula reservas existentes (RN-10,
RN-13, RN-14 y RN-15; protecciones vigentes incluyen reservas en curso con fin futuro).

### Compatibilidad con HU-05, HU-06 y HU-14

- HU-05 debe leer la misma ocupación, tanto en `slots` como en `occupiedIntervals`,
  sin exponer contacto, IDs de reserva ni identidades. La implementación backend de
  HU-05 ya está integrada por PR #22; su consulta lee intervalos de `reservations`
  sin depender del organizador ni seleccionar contactos. La grilla visual sigue pendiente.
- `GET /api/v1/reservations` sigue consultando por organizador, no por registrante.
  El registrante puede tener reservas web propias: esas sí deben conservarse.
  Los avisos web previos y nuevos mantienen payload, destinatario y atomicidad.
- Coordinar con Seba el discriminador antes de implementar HU-14: su futura cancelación
  debe exigir origen `web` y organizador real; `registered_by` **no concede ownership**.
  No ampliar HU-14 a manuales ni aplicar por accidente su regla de cuatro horas.
  No crear cancelación administrativa en HU-15 ni modificar aquí TDD-0010/TDD-0008.

## Casos de Borde y Errores

Usar el formato existente `{"error":"mensaje"}`, sin datos personales ni detalles SQL.
Para un actor autenticado ajeno, responder `403` antes de exponer el recurso objetivo;
un actor con permiso recibe `404` si el complejo/cancha no existe, está inactivo o la
cancha no pertenece al complejo solicitado.

| Escenario | Resultado esperado | Código HTTP |
| --- | --- | --- |
| Entrada inválida o intento de establecer campos del servidor | `solicitud inválida`, sin persistencia | 400 |
| JWT ausente, inválido o vencido | `no autorizado` | 401 |
| Jugador, encargado ajeno o asignación inválida | Sin reserva ni filtración de contacto | 403 |
| Recurso inexistente/inactivo o cancha de otro complejo, tras autorizar | `recurso no encontrado` | 404 |
| Inicio pasado o exactamente ahora | `turno no disponible` | 409 |
| Día ausente/deshabilitado, fuera de franja, no alineado o fin fuera del día | `turno no disponible` | 409 |
| Intervalo ocupado o carrera perdida | `turno no disponible`, sin segunda fila | 409 |
| Fallo de consulta/inserción/commit | `no se pudo crear la reserva`, rollback | 500 |

## Plan de Implementación

1. Aprobar este TDD; coordinar responsable/reviewer, modelo con Seba y numeración de
   migraciones, sin publicar comentarios ni modificar Trello sin autorización.
2. Integrar la documentación aprobada. **En otro chat**, crear
   `feature/reservas-manuales` desde Desarrollo actualizado, con dependencias integradas
   (incluida HU-05 para demostrar disponibilidad real). No partir de esta rama documental.
3. **Red**: una prueba por regla observable relevante, por dominio y flujo público
   HTTP/PostgreSQL, no por archivo; observar fallos por comportamiento faltante.
4. **Green**: migración nueva compatible y alta mínima usando validación/ocupación común,
   permisos dentro de transacción y efectos específicos por origen.
5. **Refactor**: eliminar duplicación con pruebas verdes; registrar comandos, resultados
   y pruebas omitidas honestamente. No fabricar Red retrospectivo.

### Matriz de pruebas para la entrega backend posterior

| Criterios | Pruebas y efectos que se deben observar |
| --- | --- |
| CA-01, CA-03 | HTTP `201` con encargado asignado y administrador general; lectura SQL del contacto normalizado, origen, registrante, organizador/acompañantes nulos e intervalo calculado; sin usuario nuevo ni aviso manual. |
| CA-01, CA-04 | `401/403/404`, aislamiento entre complejos y cancha ajena; comprobar conteos y datos sin cambios tras cada rechazo. |
| CA-02, CA-04 | `400` para formatos/campos inválidos; `409` para pasado, ahora exacto, día deshabilitado/ausente, desalineación, fin fuera de franja y ocupación; ninguna escritura parcial. Reloj controlado en pruebas de dominio. |
| CA-04 | Carreras manual/manual y manual/web con PostgreSQL real, sincronizadas para competir: exactamente un `201`, otro `409`, una sola ocupación; aviso únicamente si gana web. Probar intervalos adyacentes y solapamiento parcial tras cambio de duración. |
| CA-06 | Alta frente a baja de cancha, baja de día, cambio incompatible, deshabilitación y cambio de duración; ejercitar ambos órdenes de locks y verificar invariantes persistidas. |
| CA-05 | GET público HU-05 devuelve `RESERVED` para manual en grilla y fuera de ella, sin contacto ni identidades en JSON; conserva el intervalo tras deshabilitar/cambiar duración. |
| CA-07, CA-09 | Regresión HTTP de alta web, respuestas, consultas propias y avisos: manual nunca se vuelve propia por registrante; reservas web propias sí permanecen. Si HU-14 está implementada, rechaza manual sin modificar datos ni avisos. |
| CA-08 | Migrar una base con reservas web previas reserved/cancelled y avisos; comparar IDs y todos los datos históricos, verificar backfill/constraints y nuevas altas web/manual. Verificar el runner de migraciones sobre una base ya actualizada. |

Con `TEST_DATABASE_URL` apuntando **exclusivamente** a PostgreSQL descartable
(`padelmatch_test`), ejecutar desde `backend/`:

```powershell
go test -count=1 ./...
go vet ./...
```

Exigir evidencia de que las pruebas PostgreSQL efectivamente se ejecutaron: un skip no
prueba persistencia ni concurrencia. Registrar versión de PostgreSQL, migraciones y
resultados reales. `go test -race` puede complementar si el entorno lo permite, pero
no reemplaza las carreras transaccionales. No modificar Docker para esta entrega.

### Fases realizadas y pendientes de aprobación

- **Verificación realizada (2026-10-29)**: fetch de origin; base documental
  `58a7cb6` de Desarrollo. Árbol inicial limpio. Inspección de ramas y worktrees
  visibles sin encontrar HU-15; no descarta trabajo sin publicar de otros integrantes.
  La tarjeta sigue en Sprint 2, sin miembros ni comentarios: responsable/reviewer
  de HU-15 aún deben confirmarse, no se asignan unilateralmente.
- **Dependencias verificadas**: PR #16 (HU-06) y #21 (protección HU-03/04) integradas;
  [PR #22](https://github.com/Aguspascual/Agiles_Grupo_13/pull/22) de Seba (`sebanor03`),
  HU-05, estaba abierta y solicitando revisión a `moyanop` en la inspección inicial.
  [PR #19](https://github.com/Aguspascual/Agiles_Grupo_13/pull/19), contrato HU-14 de Seba,
  integrada. El usuario la refiere aprobada; el archivo integrado aún se autodenomina
  borrador v2. No se cambia ese estado histórico ni se amplía su alcance.
- **Archivos principales**: este TDD y su enlace en el índice. Futura implementación:
  módulo `backend/internal/reservations`, migración nueva y composición de rutas;
  pruebas de integración con HU-03/04/05/06. Ninguno se implementa ahora.
- **Validaciones documentales**: estructura de la plantilla, enlaces relativos,
  JSON de ejemplo, identificador libre y alcance exclusivo del alta.
- **No ejecutado en esta entrega**: Red/Green/Refactor, suite Go, `go vet`, migración
  o PostgreSQL; no hay cambios funcionales que verificar. Se exigirán en el otro chat.
- **Pendiente**: aprobación humana v1, coordinación explícita con Seba y confirmación
  de trabajo local del equipo; publicación e integración solo con autorización.
  La conexión visual del frontend queda pendiente, no realizada.
- **Actualización previa a la PR (2026-10-29)**: el usuario autorizó publicar esta
  documentación y solicitar revisión a Seba (`sebanor03`), dejando el código para
  después de la aprobación e integración. Nuevo fetch confirmó PR #22 integrada en
  Desarrollo (`d53ad93`). La rama documental se actualizó por fast-forward, sin
  conflictos ni cambios a los archivos de esta propuesta. Se comprobó la consulta
  real de ocupación de HU-05; no cambió el contrato manual ni se ejecutó código nuevo.
  Esta actualización sustituye únicamente el estado pendiente de integración de HU-05;
  la coordinación del modelo y las migraciones con Seba sigue pendiente.
