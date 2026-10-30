---
id: "0013"
estado: Aprobado por solicitante; revisión backend pendiente
version: 1
autor: "Equipo backend"
fecha: "2026-10-29"
titulo: "Consulta de reservas propias próximas y pasadas"
hu: HU-17
capa: backend
trello: "https://trello.com/c/oXCsgyd5"
---

# TDD-0013: Consulta de reservas propias próximas y pasadas

> Propuesta aprobada por el solicitante el 29/10/2026; pendiente de revisión backend e integración. No es un acuerdo histórico. Entrega parcial: excluye partidos a los que el usuario se sumó. Incorporarlos cuando exista persistencia de participación HU-09/11 antes de cerrar HU-17.

## Contexto de Negocio (PRD)

### Objetivo
Consultar reservas propias separadas temporalmente y mostrar su estado persistido. Pasado significa que terminó el horario, no que el jugador asistió.

### User Persona
- **Rol:** jugador organizador.
- **Necesidad:** consultar sus reservas sin exponer datos de terceros.

### Criterios de Aceptación
- **CA-01:** JWT obligatorio e identidad exclusivamente del token; devolver solo reservas propias sin contacto, credenciales ni datos de terceros.
- **CA-02:** capturar un único instante del servidor (RN-07); próximas si `ends_at > now`, incluidas en curso; pasadas si `ends_at <= now`.
- **CA-03:** incluir estados persistidos `reserved` y `cancelled`, clasificar por el intervalo original y no inferir asistencia ni inventar estado jugado. Conservar reservas de recursos dados de baja lógica.
- **CA-04:** ordenar próximas por inicio e ID ascendentes y pasadas por inicio e ID descendentes; paginación sobre el estado actual, sin garantizar instantánea entre peticiones.
- **CA-05:** validar estrictamente la consulta, responder lista vacía como `[]` y errores genéricos; no modificar reservas ni avisos.
- **CA-06:** preservar el endpoint por fecha de [TDD-0007](TDD-0007-hu-06-consulta-reservas-propias.md), el alta y los avisos.

## Diseño Técnico (RFC)

### Modelo de Datos
Leer `reservations`, `complexes` y `courts` por organizador autenticado y el instante capturado, sin filtrar baja lógica. Los nombres reflejan valores actuales. No se prevén migraciones ni escrituras; no crear tablas de historial, participantes ni asistencia. Si HU-15 cambia el esquema, revisar compatibilidad: el empleado que registra una reserva manual no es por ello el jugador propietario. No modificar su contrato unilateralmente.

### Contrato de API
- **Endpoint:** `GET /api/v1/me/reservations?view=upcoming&limit=20&offset=0`.
- **Autenticación:** `Authorization: Bearer <JWT>` obligatorio.
- **Query:** `view` obligatorio (`upcoming` o `past`); `limit` entero opcional entre 1 y 100, predeterminado 20; `offset` entero no negativo opcional, predeterminado 0. Rechazar parámetros desconocidos, repetidos, vacíos o inválidos.
- **Response `200 OK`:**

```json
{
  "reservations": [{
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "status": "reserved",
    "complex": { "id": "6ba7b810-9dad-41d1-80b4-00c04fd430c8", "name": "Complejo Norte" },
    "court": { "id": "6ba7b811-9dad-41d1-80b4-00c04fd430c8", "name": "Cancha 1" },
    "startsAt": "2026-11-03T18:00:00-03:00",
    "endsAt": "2026-11-03T19:30:00-03:00",
    "timeZone": "America/Argentina/Buenos_Aires"
  }],
  "page": { "limit": 20, "offset": 0, "hasMore": false }
}
```

Timestamps ISO 8601 con offset. Sin resultados: `{"reservations":[],"page":{"limit":20,"offset":0,"hasMore":false}}`. Consultar como máximo `limit + 1` filas para calcular `hasMore`. Respuestas con `Cache-Control: no-store`; errores con el formato existente `{"error":"mensaje"}`. Esta operación no reemplaza ni modifica `GET /api/v1/reservations?date=AAAA-MM-DD`.

### Componentes del Monolito Modular
- **Modelo:** representación y validación de parámetros.
- **Servicio HTTP:** reutilizar autenticación, capturar el reloj una vez y responder sin datos sensibles.
- **Repositorio:** lectura SQL parametrizada en el módulo de reservas existente, sin módulo general de historial ni escrituras.
- **Rutas:** agregar operación independiente, preservando las existentes.

## Casos de Borde y Errores
| Escenario | Resultado esperado | HTTP |
| --- | --- | --- |
| JWT ausente o inválido | Error de autenticación | 401 |
| Query desconocida, repetida, vacía o inválida | Error de validación | 400 |
| `ends_at == now` | Reserva pasada | 200 |
| Sin reservas o última página | Lista vacía o restante, `hasMore: false` | 200 |
| Fallo interno | Error genérico sin detalles | 500 |

## Plan de Implementación
1. Obtener aprobación humana e integrar el contrato; implementar en otra rama desde Desarrollo actualizado.
2. Red → Green → Refactor por criterio: futuro, curso, final y frontera exacta; canceladas y su intervalo; desempate; paginación y vacío; autenticación, aislamiento entre dos usuarios, privacidad y recursos dados de baja (CA-01 a CA-05).
3. Regresión del endpoint por fecha, alta de reservas y avisos (CA-06). Integración HTTP con PostgreSQL descartable y filas históricas controladas; comprobar que reservas y avisos no cambian.
4. Desde `backend`, ejecutar `go test -count=1 ./...` y `go vet ./...` con `TEST_DATABASE_URL` exclusivamente descartable. Registrar evidencia por criterio; PostgreSQL omitido queda pendiente, no aprobado.
5. Documentar comandos, resultados y alcance parcial. No agregar `matches: []` ni cerrar HU-17 antes de incorporar partidos en que participa el usuario.
