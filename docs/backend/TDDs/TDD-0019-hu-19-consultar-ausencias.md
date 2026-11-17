---
id: "0019"
estado: Propuesta técnica para revisión; criterios autorizados por el usuario
version: 1
fecha: "2026-11-14"
titulo: Consultar participantes y reportes de ausencia
hu: HU-19
---

# TDD-0019: Consulta de ausencias

## Contexto de negocio (PRD)

El participante consulta los anotados del partido terminado, los reportes recibidos y si ya reportó a alguien. La consulta permanece disponible al vencer las 48 horas.

- **CA-01:** JWT y pertenencia al partido obligatorios; solo nombres e identificadores necesarios, sin correos, contactos ni identidad de los demás reportantes.
- **CA-02:** devolver conteo real, `confirmed` con dos o más, `reportedByMe` y `canReport` individual. La consulta no modifica datos.
- **CA-03:** informar fin original, vencimiento y reloj del servidor. Frente a errores/cambios el frontend puede volver a consultar.

## Diseño técnico (RFC)

Modelo y transacciones compartidos con [TDD-0018](TDD-0018-hu-19-registrar-ausencia.md). No alterar el DTO de HU-17 ni usar el listado público, que filtra partidos futuros.

`GET /api/v1/matches/{matchId}/absence-reports`, sin query ni cuerpo. JWT obligatorio. `200`, `Cache-Control: no-store`:

```json
{
  "matchId": "UUID",
  "endsAt": "2026-11-14T19:30:00-03:00",
  "deadline": "2026-11-16T19:30:00-03:00",
  "serverNow": "2026-11-14T20:00:00-03:00",
  "windowOpen": true,
  "players": [
    {"id":"UUID A","name":"Ana","isSelf":true,"reportCount":0,"confirmed":false,"reportedByMe":false,"canReport":false},
    {"id":"UUID B","name":"Bruno","isSelf":false,"reportCount":1,"confirmed":false,"reportedByMe":true,"canReport":false}
  ]
}
```

`windowOpen` indica la ventana temporal habilitada; `canReport` requiere además no ser el propio jugador y no haber reportado previamente. Horas RFC3339 con precisión preservada, en `America/Argentina/Buenos_Aires`. El cliente muestra `min(reportCount,2)/2`.

| Caso | HTTP |
| --- | --- |
| Sin autenticación | 401 |
| No participante | 403 |
| ID, query o cuerpo inválido | 400 |
| Partido inexistente | 404 |
| Fallo interno | 500 |

## Plan y pruebas

Comprobar privacidad, permisos de consulta, estado propio, recarga desde otra instancia de HTTP, ventana vencida con reportes conservados y aislamiento entre partidos. Pruebas Angular con respuestas HTTP: apertura desde Jugados, confirmación/cancelación, pendiente/confirmado, duplicado, expiración, errores y reintentos.
