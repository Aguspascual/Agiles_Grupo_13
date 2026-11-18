---
id: "0018"
estado: Propuesta técnica para revisión; criterios autorizados por el usuario
version: 1
fecha: "2026-11-14"
titulo: Registrar un reporte de ausencia
hu: HU-19
---

# TDD-0018: Registrar ausencia

## Contexto de negocio (PRD)

Un jugador anotado informa la ausencia de otro jugador del mismo turno. Dos jugadores diferentes deben confirmarla para evitar que un único reporte registre una ausencia confirmada.

### Criterios de aceptación

- **CA-01:** después de finalizar el turno, un anotado puede reportar a otro anotado. Se valida identidad JWT, pertenencia de ambos y prohibición de autorreporte.
- **CA-02:** plazo de 48 horas desde `reservations.ends_at`, usando reloj del servidor. Ventana propuesta: `ends_at <= now <= ends_at + 48h`, sin redondear; el extremo inicial coincide con la clasificación Jugados de HU-17. Los tests incluyen ambos extremos y un microsegundo fuera.
- **CA-03:** al menos dos reportantes distintos confirman la ausencia. Los reportes y su consulta sobreviven al vencimiento y al reinicio del servicio.
- **CA-04:** cada jugador puede reportar a cada otro jugador una sola vez por partido, incluso con peticiones concurrentes.

RN-07 orienta reloj/zona horaria. RN-04 impide inventar identidad para acompañantes. No se incorpora reputación HU-20 ni notificaciones.

## Diseño técnico (RFC)

### Modelo

Migración aditiva `020_match_absence_reports.sql` (015–019 están ocupadas en Desarrollo). Tabla `match_absence_reports`:

- `match_id`, `reported_user_id`, `reporter_user_id`: UUID, clave primaria conjunta.
- Dos FK compuestas hacia `pending_match_players(match_id,user_id)`, con `ON DELETE RESTRICT`: ambas personas deben estar anotadas en el partido y los reportes no desaparecen por una eliminación en cascada.
- `CHECK (reported_user_id <> reporter_user_id)`.
- `created_at TIMESTAMPTZ NOT NULL`: instante del servidor usado para validar el reporte.

La ausencia confirmada se deriva de `count(*) >= 2`; no hay contador o booleano persistido redundante. Un tercer reporte válido se conserva, aunque la interfaz muestra el umbral como 2/2.

### Transacción y concurrencia

Bloquear primero la reserva y luego el partido, el mismo orden que usa HU-12 al cancelar partidos incompletos. Rechazar partidos cancelados. Comprobar membresías y capturar el reloj después de obtener los bloqueos. Insertar el reporte y consultar el estado en la misma transacción. La clave primaria protege duplicados también fuera del handler. Consultas parametrizadas y contexto cancelable. Lecturas con bloqueos compartidos en el mismo orden para obtener una cabecera consistente.

### Contrato de alta

`POST /api/v1/matches/{matchId}/absence-reports`

JWT obligatorio, sin query; JSON estricto:

```json
{"playerId":"UUID del jugador reportado"}
```

Respuesta `201`: estado completo definido en [TDD-0019](TDD-0019-hu-19-consultar-ausencias.md), actualizado desde la transacción. `Cache-Control: no-store`. Identidad del reportante exclusivamente del token.

| Caso | HTTP |
| --- | --- |
| JWT ausente/inválido | 401 |
| Usuario autenticado no anotado, incluso administrador | 403 |
| UUID/JSON/query inválidos, autorreporte o reportado no anotado | 400 |
| Partido inexistente | 404 |
| Turno sin finalizar, ventana vencida o reporte duplicado | 409 |
| Error interno | 500 |

Errores con formato existente `{"error":"mensaje"}` y sin datos SQL ni personales sensibles.

### Componentes

Módulo `internal/matches`: modelo, repositorio de ausencias y handlers en archivos separados. Rutas autenticadas en `cmd/api/routes.go`. Frontend: servicio HTTP y panel independiente dentro de Jugados, confirmación accesible antes del envío, reintentos y sincronización del estado.

## Casos pendientes de aprobación

Se autorizó aplicar el alcance exclusivamente a `pending_matches` no cancelados y participantes registrados que continúen inscriptos. Se excluyen bajas anteriores al turno, invitados sin cuenta, HU-16 y datos históricos eliminados; no reconstruir información perdida ni extender reglas de otras HUs por inferencia.

## Plan de implementación y pruebas

Red → Green → Refactor con HTTP real y PostgreSQL descartable: antes del fin, fin exacto, dentro de 48h, límite y vencimiento; ambos permisos, autorreporte, duplicados, dos reportantes, dos peticiones simultáneas, aislamiento y persistencia. Verificar restricciones directamente en PostgreSQL y plazo después de esperar bloqueos. Ejecutar Go, vet, Angular afectado y build; evidencia en el documento de fases.
