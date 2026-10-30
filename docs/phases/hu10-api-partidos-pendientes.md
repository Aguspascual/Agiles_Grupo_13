# API de partidos pendientes (HU-10)

Todos los endpoints usan el prefijo `/api/v1`. Las rutas de consulta marcadas como públicas no requieren JWT. Crear, unirse y operar avisos requiere sesión.

## Consultar partidos abiertos

`GET /matches?date=YYYY-MM-DD&complexId=<uuid>&level=<nivel>`

Filtros opcionales: fecha local argentina, identificador del complejo y nivel buscado. Devuelve convocatorias abiertas futuras con hasta cuatro participantes visibles. El payload público no incluye identificadores de usuario, reserva, correo ni teléfono.

## Opciones para crear partido

`GET /public/complexes`

Devuelve complejos no dados de baja con sus canchas activas, dirección y zona. No expone el teléfono del complejo ni datos de gestión.

La disponibilidad continúa usando el contrato existente:

`GET /complexes/{complexId}/slots?date=YYYY-MM-DD`

Solo franjas `AVAILABLE` que no hayan pasado son elegibles.

## Crear partido abierto

`POST /complexes/{complexId}/courts/{courtId}/matches` (JWT)

```json
{
  "date": "2026-11-02",
  "startsAt": "19:00",
  "targetLevel": "5ta"
}
```

La duración sale del horario configurado para la cancha. Reserva, convocatoria y jugador organizador se guardan de forma atómica. Un horario inválido, pasado u ocupado responde `409`.

## Unirse

`POST /matches/{matchId}/players` (JWT; sin cuerpo)

Devuelve el partido actualizado. `409` indica que ya participás o que no quedan plazas. La inserción serializa por partido para que una única persona gane el último lugar. Al llegar a cuatro se marca completo y se guardan avisos individuales.

## Avisos de grupo completo

- `GET /match-notices` (JWT): lista avisos no leídos de la cuenta.
- `POST /match-notices/{noticeId}/read` (JWT): marca como leído un aviso propio; responde `204`.

## Grupo completo HU-06

Se reutiliza `POST /complexes/{complexId}/courts/{courtId}/reservations` (JWT), con `date`, `startsAt` y `contact: { name, phone }`. Esta API confirma la ocupación completa, pero no crea una convocatoria visible en `/matches`.

## Errores principales

- `400`: filtros o datos con formato inválido.
- `401`: falta sesión o expiró el JWT para una operación protegida.
- `404`: complejo, cancha, partido o aviso no encontrado.
- `409`: horario ocupado, partido completo o jugador duplicado.
- `500`: error inesperado del servicio.

## Pendientes de API

El esquema no ofrece precio real ni teléfono en el perfil del jugador. Se solicita el teléfono al responsable solo para reserva grupal completa y no se publica. Fotos reales de cancha y flujo de cancelación quedan para historias posteriores.
