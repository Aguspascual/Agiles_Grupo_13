# Contrato propuesto — HU-05 Grilla de turnos del complejo

**Estado:** implementado por backend (`backend/internal/slots`) e integrado en el frontend (`SlotGridService`). Diferencias reales respecto de la propuesta original:

- Cada turno trae `{id, startsAt, endsAt, status, isPast}`; `isPast` lo calcula el backend en hora de Buenos Aires. El turno no trae `courtId` ni `date`: el frontend los deriva de la cancha y del día pedido.
- `status` es `AVAILABLE | PENDING_MATCH | RESERVED | BLOCKED` (TDD-0009 v3). `PENDING_MATCH` ya se emite: el turno lo ocupa una sola reserva de partido abierto con lugares libres y todavía no empezó; trae `pendingMatch: {missingPlayers, level}` (solo en ese estado, sin nombres ni ids). Un partido completo, varias reservas superpuestas o un turno pasado se informan `RESERVED`. `CLASS` aún no se emite (no existe el concepto de clase en el backend). `BLOCKED` equivale a un día deshabilitado en HU-04.
- Cada cancha agrega `occupiedIntervals[]`; el frontend lo ignora.
- Ventana: desde hoy hasta hoy + 13 días (fuera de ella, `400`). La consulta acepta **solo** `date`; cualquier otro parámetro devuelve `400`. `404` si el complejo no existe o está dado de baja; `400` si el id no es UUID.
- El listado de clubes para llegar a la grilla es `GET /api/v1/public/complexes` (TDD-0014).

## Endpoint

```
GET /api/v1/complexes/{complexId}/slots?date=AAAA-MM-DD
```

- **Público:** no requiere JWT. Según HU-01, sin sesión se puede ver la grilla pero no reservar.
- `date` es obligatorio y se interpreta en la hora de Argentina (America/Argentina/Buenos_Aires).
- Devuelve los turnos de **un solo día**. Se calculan a partir de las reglas semanales de HU-04 y se combinan con bloqueos y reservas; no hace falta guardar una fila por cada turno libre.

## Respuesta `200`

```json
{
  "complex": {
    "id": "8b1f…",
    "name": "La Cumbre Pádel",
    "address": "Calle 131 y 32",
    "zone": "San Carlos"
  },
  "date": "2026-10-23",
  "courts": [
    {
      "id": "c41a…",
      "name": "Cancha 1",
      "covered": true,
      "slots": [
        { "id": "c41a…:2026-10-23:18:30", "startsAt": "18:30", "endsAt": "20:00", "status": "AVAILABLE" },
        { "id": "c41a…:2026-10-23:20:00", "startsAt": "20:00", "endsAt": "21:30", "status": "PENDING_MATCH",
          "pendingMatch": { "missingPlayers": 2, "level": "5ta" } },
        { "id": "c41a…:2026-10-23:21:30", "startsAt": "21:30", "endsAt": "23:00", "status": "RESERVED" }
      ]
    }
  ]
}
```

| Campo | Tipo | Detalle |
|---|---|---|
| `courts[]` | lista | Solo canchas activas del complejo, en el orden en que deben mostrarse. |
| `slots[].id` | string | Identificador estable del turno. Se usa después para reservar (HU-06). Sugerencia: `courtId:fecha:hora`. |
| `slots[].startsAt` / `endsAt` | `"HH:MM"` | Hora local. Duración de 60 o 90 minutos según la regla de la cancha. |
| `slots[].status` | enum | `AVAILABLE` (Libre), `PENDING_MATCH` (Partido abierto), `RESERVED` (Reservado), `CLASS` (Clase: el complejo reservó el turno para dar una clase) y `BLOCKED` (cerrado por el complejo; el jugador lo ve como "No disponible"). En el Sprint 3 se suma `AWAITING_PAYMENT` (seña). |
| `slots[].pendingMatch` | objeto | Solo con `PENDING_MATCH`: `missingPlayers` (1 a 3) y `level` (categoría buscada, por ejemplo `"5ta"`). |

Prioridad de estados (implementada): `BLOCKED` solo si el turno no tiene reserva; si lo ocupa una reserva es `PENDING_MATCH` o `RESERVED`. Propuesta original, no vigente: un turno **bloqueado** se informa como `BLOCKED` aunque tenga datos de reserva; después `CLASS`, `PENDING_MATCH` o `RESERVED`; si no hay nada, `AVAILABLE`.

**Privacidad:** este endpoint es público, así que **no** debe incluir nombre ni teléfono de quien reservó. Esos datos van en la agenda del encargado (HU-07), con un endpoint autenticado.

## Turnos pasados

El frontend marca como pasado todo turno cuyo inicio ya ocurrió y no deja elegirlo. Backend igual debe rechazar la reserva de un turno pasado en HU-06. Opcional: agregar `"bookable": false` para no depender del reloj del navegador.

## Errores

| Código | Cuándo |
|---|---|
| `400` | Falta `date` o no tiene formato `AAAA-MM-DD`. |
| `404` | El complejo no existe o está dado de baja. El frontend muestra "No encontramos este club". |

Formato de error sugerido, igual al resto de la API: `{ "error": "mensaje legible" }`.

## Ventana de consulta

El frontend permite consultar desde hoy hasta 13 días después (14 días en total). Backend puede rechazar fechas fuera de ese rango con `400`, o devolverlas igual; el frontend no las pide.
