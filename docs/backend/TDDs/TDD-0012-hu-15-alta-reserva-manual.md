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

## Contexto de Negocio (PRD)

### Objetivo
Permitir que el encargado registre nombre y teléfono de un cliente que reserva por teléfono o WhatsApp y ocupe un turno, visible como reservado igual que los registrados desde la web ([HU-15](https://trello.com/c/H3L4wVmS)).

Esta operación cubre únicamente el alta manual. No incluye edición, cancelación, agenda, participantes, pagos ni notificaciones externas. No modifica frontend ni Docker; la integración visual queda pendiente.

### User Persona
- **Rol:** encargado asignado al complejo o administrador general.
- **Necesidad:** registrar reservas recibidas fuera de la web para reflejar la ocupación real de la cancha.

### Criterios de Aceptación
- **CA-01:** permitir el alta al encargado asignado al complejo y al administrador general autenticados; denegar a jugadores y encargados ajenos, manteniendo la política administrativa existente.
- **CA-02:** aceptar solo turnos estrictamente futuros, alineados con una franja habilitada y completos dentro de ella. El servidor determina duración y fin según la configuración vigente (RN-07, RN-11, RN-13 y RN-14).
- **CA-03:** persistir contacto, origen manual, registrante real e intervalo en la misma tabla de reservas. No crear cuentas ni asignar al empleado como organizador o jugador; tampoco inventar tres acompañantes.
- **CA-04:** autorizar, validar disponibilidad y registrar dentro de una transacción. Un rechazo no deja escrituras parciales; en carreras manual/manual o manual/web solo una reserva ocupa el intervalo.
- **CA-05:** HU-05 muestra la ocupación como `RESERVED`, sin exponer contacto ni identidades. Conservar el intervalo real aunque luego cambie la grilla o se deshabilite el día.
- **CA-06:** aplicar a las reservas manuales las protecciones de baja de cancha y cambios de horarios de HU-03/04; no modificar ni cancelar sus intervalos existentes (RN-10, RN-13, RN-14 y RN-15).
- **CA-07:** conservar respuestas, consultas propias y avisos de HU-06. La reserva manual no aparece como reserva personal del registrante ni genera avisos para el cliente sin cuenta o el empleado como supuesto organizador.
- **CA-08:** migrar sin perder ni alterar los datos y contratos de las reservas web existentes, incluidos sus avisos.
- **CA-09:** mantener HU-14 limitada a organizadores de reservas web de HU-06. Registrar una reserva manual no concede permiso para cancelarla.

## Diseño Técnico (RFC)

### Modelo de Datos
Reutilizar `reservations`, sus campos de contacto y el índice parcial `reservations_active_court_interval_idx`, que incluye las filas `status = 'reserved'`. Este índice no es único; la exclusión de altas concurrentes depende del bloqueo transaccional compartido.

La migración actual exige organizador y tres acompañantes. Se propone una nueva migración compatible con estos campos y restricciones:

- `origin`: texto obligatorio, `web` o `manual`, determinado por el servidor.
- `registered_by`: UUID obligatorio con FK a `users`; identifica al usuario que registra la reserva, no al cliente.
- `organizer_id`: UUID con FK a `users`; obligatorio en web y `NULL` en manual.
- `companions`: entero pequeño; `3` en web y `NULL` en manual. En una reserva manual la cantidad de participantes no se informa; no significa cero jugadores.
- `contact_name`, `contact_phone`: contacto obligatorio, reutilizando las columnas existentes. No buscar ni vincular automáticamente cuentas por nombre o teléfono.
- `starts_at`, `ends_at`, `status`: conservar el intervalo definitivo y los estados existentes; el alta manual usa `reserved`.

Aplicar la migración sin reescribir las anteriores ni usar una tabla paralela:

1. Agregar `origin` con valor predeterminado `web` y `registered_by` inicialmente nullable. Completar las filas previas con `registered_by = organizer_id`, conservando IDs, contactos, acompañantes, intervalos, estados y avisos.
2. Exigir `registered_by NOT NULL` y su FK. Sustituir la obligatoriedad incondicional de organizador/acompañantes y el CHECK actual por restricciones según el origen:
   - Web: `organizer_id IS NOT NULL`, `companions IS NOT NULL AND companions = 3` y `registered_by = organizer_id`.
   - Manual: `organizer_id IS NULL AND companions IS NULL`.
   - `origin IN ('web', 'manual')`. Usar comprobaciones explícitas de nulabilidad para que un resultado SQL `NULL` no eluda un CHECK.
3. Adaptar la escritura web para completar el registrante sin cambiar sus DTO ni avisos. Coordinar aplicación de migración y despliegue; no dejar escritores antiguos frente a la nueva columna obligatoria.

Conservar FKs e índice de ocupación. No borrar registros ni ofrecer una reversión que pierda reservas manuales. Coordinar el siguiente número libre con Seba: [TDD-0010](TDD-0010-hu-14-cancelacion-reserva.md) propone una migración para avisos de cancelación; no asumir que su numeración ya está aplicada.

### Contrato de API
- **Endpoint:** `POST /api/v1/complexes/{complexId}/courts/{courtId}/manual-reservations`.
- **Autenticación:** `Authorization: Bearer <JWT>` mediante HU-01.
- **Permisos:** encargado asignado al complejo o administrador general, sin exigir asignación a este último. Validar rol y pertenencia dentro de la transacción; el actor se obtiene del contexto autenticado.
- **Request Body:** todos los campos mostrados son obligatorios.

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

Fecha estricta `YYYY-MM-DD` y hora `HH:mm`, interpretadas con el reloj del servidor en `America/Argentina/Buenos_Aires` (RN-07). Reutilizar la normalización y validaciones de HU-06: quitar espacios extremos de nombre y teléfono y exigir ambos no vacíos, sin introducir otro formato telefónico.

Rechazar JSON inválido, campos desconocidos, tipos incorrectos, omisiones, UUID inválidos y parámetros de consulta. No aceptar duración, fin, estado, origen, registrante, organizador ni acompañantes en el cuerpo.

- **Response:** `201 Created`, con la envoltura y forma de reserva de HU-06. Ejemplo para una configuración de 90 minutos y un inicio futuro válido:

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

Usar `Content-Type: application/json` y `Cache-Control: no-store`. La respuesta no expone contacto ni registrante. El estado persistido `reserved` se representa como `RESERVED` en la consulta pública de HU-05.

### Componentes del Monolito Modular
- **Modelo:** reutilizar `Request`, `Contact`, validación temporal y `slotWithinSchedule` del módulo de reservas. Mantener los contratos web existentes.
- **Servicio HTTP:** incorporar la nueva ruta protegida por JWT, reutilizar decodificación estricta y traducción de errores. No relajar los permisos del alta web.
- **Repositorio:** compartir validación y ocupación entre alta web y manual, sin duplicarlas por endpoint. En una transacción:
  1. Bloquear complejo activo con `FOR SHARE` y después cancha activa del complejo con `FOR UPDATE`, en el mismo orden que los escritores actuales.
  2. Verificar rol y asignación vigentes con la política administrativa existente y su protección transaccional; no autorizar únicamente antes de obtener los bloqueos.
  3. Revalidar el inicio futuro después de esperar los locks; leer el día habilitado, su duración de 60/90 minutos y sus franjas. Exigir alineación desde el inicio de la franja y fin dentro de ella, sin cruzar medianoche.
  4. Comprobar solapamiento contra cualquier reserva `reserved`, sin filtrar origen: `starts_at < nuevo_fin AND ends_at > nuevo_inicio`. Los intervalos son semiabiertos `[inicio, fin)`; los adyacentes no se solapan.
  5. Insertar la reserva y confirmar antes de responder `201`. Ante un error, rollback completo; consultas parametrizadas y contexto cancelable.
- **Efectos por origen:** el alta web mantiene su aviso `reservation_confirmed` en la misma transacción; la manual no inserta avisos. Las consultas propias siguen filtrando por organizador, nunca por registrante.

HU-03/04 deben usar los mismos bloqueos: si gana un cambio de horario, el alta revalida la configuración resultante; si gana la reserva, se rechaza con `409` el cambio incompatible. Deshabilitar o cambiar duración conserva las reservas y sus intervalos, incluidas las vigentes en curso con fin futuro.

HU-05 lee la ocupación desde la misma tabla, sin seleccionar contacto ni depender del organizador; mantiene `slots` y `occupiedIntervals` conforme a [TDD-0009](TDD-0009-hu-05-consulta-publica-disponibilidad-turnos.md). Coordinar el discriminador con Seba antes de implementar HU-14: su cancelación debe exigir origen web y organizador real; `registered_by` no concede ownership. HU-15 no amplía ese contrato ni implementa cancelación administrativa.

## Casos de Borde y Errores
Todos los errores usan `{"error":"mensaje"}`, sin contacto ni detalles SQL. Denegar al actor ajeno antes de exponer información del recurso; tras autorizar, responder `404` para recursos inexistentes, inactivos o una cancha que no pertenezca al complejo solicitado.

| Escenario | Resultado Esperado | Código HTTP |
| --- | --- | --- |
| Entrada inválida o campos reservados al servidor | `solicitud inválida`; sin escrituras | 400 |
| JWT ausente, inválido o vencido | `no autorizado` | 401 |
| Jugador, encargado ajeno o asignación inválida | Sin reserva ni datos del recurso | 403 |
| Recurso inexistente/inactivo o cancha de otro complejo, tras autorizar | `recurso no encontrado` | 404 |
| Inicio pasado o exactamente ahora | `turno no disponible`; sin escrituras | 409 |
| Día ausente/deshabilitado, inicio desalineado o fuera de franja, o fin fuera de ella | `turno no disponible`; sin escrituras | 409 |
| Intervalo ocupado o carrera perdida | `turno no disponible`; sin segunda reserva | 409 |
| Fallo de consulta, inserción o commit | `no se pudo crear la reserva`; sin escrituras parciales | 500 |

## Plan de Implementación
1. Aprobar criterios, modelo y contrato; coordinar con Seba la compatibilidad con HU-14 y la numeración de migraciones antes de implementar.
2. Red → Green de CA-02/03: validaciones de contacto, fechas, límite temporal, franjas y duración; usar reloj controlado. Probar reglas de dominio relevantes, no archivos individuales.
3. Red → Green HTTP/PostgreSQL de CA-01/03/04: alta válida y lectura del contacto persistido, permisos y aislamiento entre complejos; rechazos sin cambios ni escrituras parciales. Verificar registrante real, ausencia de organizador/acompañantes manuales y ausencia de cuentas o avisos nuevos.
4. Probar concurrencia real manual/manual y manual/web: un `201`, un `409` y una sola ocupación; aviso solo si gana web. Cubrir solapamiento parcial y turnos adyacentes, y ambos órdenes de bloqueo frente a baja de cancha, baja de día y cambios de horarios (CA-04/06).
5. Integrar con HU-05 y verificar `RESERVED`, privacidad e intervalos conservados ante cambios de grilla (CA-05). Probar regresión de altas web, consultas propias y avisos; si HU-14 está implementada, comprobar que rechaza reservas manuales sin modificarlas (CA-07/09).
6. Aplicar la migración sobre datos web existentes, tanto `reserved` como `cancelled`, con avisos; comparar registros, relaciones y contratos antes/después y probar nuevas altas de ambos orígenes (CA-08).
7. Refactor con pruebas verdes. Ejecutar desde `backend/` `go test -count=1 ./...` y `go vet ./...` con `TEST_DATABASE_URL` contra PostgreSQL descartable. Registrar resultados en la PR; una prueba omitida no demuestra persistencia, permisos, concurrencia ni disponibilidad.
