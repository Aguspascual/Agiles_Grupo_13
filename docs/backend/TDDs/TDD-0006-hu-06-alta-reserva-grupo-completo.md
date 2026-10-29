---
id: "0006"
estado: Borrador — pendiente de aprobación humana
version: 1
autor: "Equipo backend"
fecha: "2026-10-28"
titulo: "Alta de reserva con grupo completo"
hu: HU-06
capa: backend
trello: "https://trello.com/c/dIhIwmhH"
---

# TDD-0006: Alta de reserva con grupo completo

> **Borrador para revisión.** Las propuestas no son acuerdos históricos ni autorizan implementar. Coordinar responsable, contrato y migraciones con el equipo antes de aprobar.

## Contexto de Negocio (PRD)

### Objetivo
Permitir que una persona autenticada reserve para su grupo completo un turno disponible de una cancha, evitando ocupaciones concurrentes y conservando los datos de contacto necesarios para el complejo.

### User Persona
- **Rol:** jugador organizador de un grupo completo.
- **Necesidad:** asegurar el turno y recibir una confirmación sin que otra reserva ocupe ese mismo intervalo.

### Fuente y estado de los criterios
- **Tarjeta HU-06:** el turno pasa a Reservado; ante dos intentos simultáneos gana solo uno; la reserva aparece en la agenda del complejo con datos de contacto; el jugador recibe confirmación con complejo, cancha, día y hora.
- **Reglas del repositorio:** RN-07 fija reloj del servidor y zona horaria; RN-11 limita las franjas recurrentes al mismo día; RN-13 impide nuevas reservas en días deshabilitados; RN-14 fija duración de 60 o 90 minutos y preserva el intervalo real de reservas existentes. RN-01 protege los partidos pendientes vigentes frente a reemplazos; esta operación no los reemplaza.
- **Propuestas de este TDD:** estructura del request, cuadrícula de turnos, datos de contacto y grupo, estados, validaciones, protección transaccional, respuesta y aviso descritos abajo. Son recomendaciones del plan local, no acuerdos históricos del equipo. El usuario indicó avanzar sin esperar aprobación de la PR y aceptó el tratamiento de reintentos descrito abajo.

### Criterios de Aceptación propuestos
- **CA-01:** una persona autenticada crea para sí una reserva de grupo completo en una cancha y complejo activos, con contacto y turno futuro válido según la configuración vigente. Persistir inicio y fin reales y estado `reserved`.
- **CA-02:** rechazar una cancha ajena al complejo, una fecha pasada, día sin configurar o deshabilitado, turno fuera de una franja o no alineado, y datos inválidos; no dejar cambios parciales.
- **CA-03:** rechazar cualquier superposición con una ocupación vigente; en dos intentos concurrentes que se solapan, exactamente uno obtiene la reserva y el otro recibe conflicto. No cancelar ni reemplazar una reserva o partido pendiente.
- **CA-04:** guardar nombre y teléfono de contacto en la reserva, sin exigir teléfono al registro de usuarios. La reserva contiene complejo, cancha, fecha, intervalo, organizador y estado necesarios para la agenda; su consulta es una operación independiente y no se considera implementada por esta alta.
- **CA-05:** devolver confirmación con complejo, cancha, fecha y hora y persistir un aviso interno para el organizador en la misma transacción. La consulta del aviso requiere su contrato separado; una respuesta HTTP por sí sola no demuestra entrega del aviso.

## Diseño Técnico (RFC)

### Modelo de Datos propuesto
- Nueva migración versionada para la reserva mínima: ID, complejo y cancha referenciados, organizador (`users`), `starts_at` y `ends_at` como instantes, estado, nombre y teléfono de contacto, fecha de creación y representación explícita de grupo completo. Conservar el intervalo real aunque cambie la duración recurrente (RN-14).
- Propuesta para esta primera entrega: organizador más tres acompañantes sin cuentas ficticias; persistir cantidad `3`, sin nombres individuales. No editar esos cupos mediante esta operación. Validar que el contrato de grupo completo sea aceptado por el equipo.
- Registrar un aviso interno persistido con destinatario, tipo y datos mínimos de confirmación. Su almacenamiento concreto y formato son propuestos y deben coordinarse con el contrato de consulta de avisos para evitar modelos incompatibles; no agregar mensajería externa ni infraestructura nueva.
- Migración aditiva, sin modificar migraciones aplicadas ni datos existentes. La consulta de agenda y la consulta de avisos requieren sus propios contratos; su ausencia impide afirmar que toda HU-06 está terminada.

### Contrato de API propuesto
- **Endpoint:** `POST /api/v1/complexes/{complexId}/courts/{courtId}/reservations`.
- **Headers:** `Authorization: Bearer <JWT>`, `Content-Type: application/json`. El organizador se determina por el JWT, no por el cuerpo.
- **Request:** fecha local y hora de inicio sin zona, interpretadas en `America/Argentina/Buenos_Aires`; el servidor deriva el fin de la duración vigente. El contacto corresponde a esta reserva y no altera el perfil.

```json
{
  "date": "2026-11-03",
  "startsAt": "18:00",
  "contact": { "name": "Ana Pérez", "phone": "+54 221 555 1234" }
}
```

- **Propuesta de validación:** `date` en `AAAA-MM-DD` y `startsAt` en `HH:MM`; contacto obligatorio, sin espacios extremos y no vacío, con límites a acordar antes de implementar. No aceptar campos adicionales ni identificadores de otro organizador. El comienzo debe ser estrictamente posterior al reloj del servidor.
- **Cuadrícula propuesta:** cada franja genera comienzos desde su apertura en múltiplos de la duración configurada; el turno completo debe caber dentro de esa misma franja. Dos turnos contiguos no se solapan: los intervalos son `[inicio, fin)`.
- **Respuesta `201 Created`:** datos de confirmación; no expone teléfono ni credenciales. Las horas son locales y se informa la zona explícitamente.

```json
{
  "reservation": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "reserved",
    "complex": { "id": "6ba7b810-9dad-41d1-80b4-00c04fd430c8", "name": "Complejo Norte" },
    "court": { "id": "6ba7b811-9dad-41d1-80b4-00c04fd430c8", "name": "Cancha 1" },
    "date": "2026-11-03",
    "startsAt": "18:00",
    "endsAt": "19:30",
    "timeZone": "America/Argentina/Buenos_Aires"
  }
}
```

El ejemplo supone un martes configurado con duración de 90 minutos y una franja compatible. Los UUID son ilustrativos. Acordar los límites de contacto antes de implementar. Si se pierde la respuesta, no reintentar automáticamente: el usuario debe consultar sus reservas antes de volver a intentar. La consulta de reservas propias tiene una operación separada en [TDD-0007](TDD-0007-hu-06-consulta-reservas-propias.md); no hay recuperación verificada hasta probar e integrar esa consulta. No declarar idempotencia ni garantías de entrega que no estén diseñadas.

### Componentes del Monolito Modular
- **Modelo:** validar fecha, horario, contacto, cuadrícula, grupo completo y estado, reutilizando reglas existentes sin reimplementarlas en varios endpoints.
- **Servicio HTTP:** autenticar, decodificar JSON estricto y resolver errores; nunca confiar en identidad o fin enviados por el cliente.
- **Repositorio:** en una transacción PostgreSQL, bloquear la fila activa de la cancha con `FOR UPDATE`, como exige `schedules/reservations.go`; leer configuración actual, comprobar ocupación, insertar reserva y aviso, y confirmar conjuntamente. La misma protección debe ser compartida por reservas web, manuales y bloqueos cuando se implementen, no duplicada por endpoint.
- **Integración:** la ausencia actual de reservas y bloqueos reales no equivale a disponibilidad demostrada frente a ocupaciones externas; coordinar el esquema común antes de construir operaciones que también ocupen intervalos.

## Casos de Borde y Errores propuestos
El cuerpo de error sigue el formato existente `{"error":"..."}`; mensajes exactos y límites de contacto se acuerdan en revisión.

| Escenario | Resultado esperado | HTTP propuesto |
| --- | --- | --- |
| JWT ausente, inválido o usuario inexistente | Sin cambios | 401 |
| JSON, fecha, hora, contacto o campos inválidos | Sin cambios | 400 |
| Complejo o cancha inexistente, inactiva o no perteneciente al complejo | Sin cambios | 404 |
| Turno pasado, día sin configurar/deshabilitado, fuera de franja o no alineado | Sin cambios | 409 |
| Intervalo solapado con reserva vigente, partido pendiente o bloqueo existente | No reemplazar ni modificar ocupación previa | 409 |
| Dos solicitudes simultáneas para intervalos solapados | Una reserva y un aviso; la otra solicitud no deja efectos | 201 / 409 |
| Error de persistencia de reserva o aviso | Revertir ambos; no filtrar detalles internos | 500 |

## Plan de Implementación y verificación propuesto
1. Coordinar responsabilidad con el equipo y frontend y resolver límites de contacto y contrato de consulta de avisos antes de iniciar la parte dependiente. El usuario autorizó avanzar sin esperar aprobación de PR; la revisión e integración de ramas se harán después. No tocar Trello ni publicar sin autorización.
2. Red → Green → Refactor con pruebas de dominio para cuadrícula y límites de intervalos significativos (CA-02/03), sin tests por archivo.
3. Integración HTTP y PostgreSQL descartable: alta válida y datos persistidos (CA-01/04), validaciones sin persistencia parcial (CA-02), carrera real por el mismo intervalo con un ganador (CA-03), aviso y rollback ante error (CA-05). Cuando existan las demás fuentes de ocupación, probar la coordinación entre cada escritor y la edición/baja de horarios; hasta entonces no afirmar cobertura de esos cruces.
4. Ejecutar `go test -count=1 ./...` y `go vet ./...` desde `backend/`. Registrar pasó, falló, omitido o no disponible; `TEST_DATABASE_URL` debe apuntar a una base descartable, no compartida.

## Dependencias y límites
- Base examinada: `origin/Desarrollo` `92e739e`. La autenticación, canchas y horarios semanales están presentes; no se ha verificado una base desplegada ni ejecutado pruebas para este borrador.
- No existe aún el origen real de reservas usado por las comprobaciones de horarios: `FutureReservationChecker` devuelve no disponible. U3 y las consultas de disponibilidad, agenda y avisos requieren sus propias entregas e integración; este documento no afirma que ya funcionen.
- No se implementan consultas, cancelación, edición de acompañantes, pagos, frontend, Docker ni servicios externos. Las notificaciones persistidas no implican email, WhatsApp ni WebSockets.
- TDD-0005 de HU-08 está en PR separada pendiente; `0006` se reserva aquí para evitar reutilizar ese identificador, sujeto a comprobarlo al integrar.
