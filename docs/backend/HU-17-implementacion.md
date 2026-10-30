# HU-17 (backend): reservas y partidos propios

TDD de referencia: [TDD-0013 v2](TDDs/TDD-0013-hu-17-consulta-reservas-propias.md) (borrador para aprobación humana).

## Fases

1. **TDD v2**: incorpora partidos (migración 008), lista unificada `items[]`, `kind`, `role`, `cancellable` y `match`.
2. **Parser estricto** (`internal/reservations/own_list.go`): `view`, `limit`, `offset`; rechaza desconocidos, repetidos, vacíos, con signo o desbordados.
3. **Repositorio**: una consulta parametrizada con `UNION ALL` de reservas web propias y partidos con participación; el orden depende de `view` (dos sentencias constantes, sin interpolar la query del usuario); `LIMIT limit+1 OFFSET offset` para `hasMore`.
4. **Handler** `listMine` en el servicio de reservas y ruta `GET /api/v1/me/reservations` protegida con `RequireUser`, también en la rama de error del servicio, como sus hermanas.

## Reglas

- Un único `now` del servidor (`Repository.now`) por petición: próximas `ends_at > now`, pasadas `ends_at <= now`.
- `kind=reservation`: `origin='web'` y `organizer_id` = usuario; `role=organizer`.
- `kind=match`: usuario en `pending_match_players`; `status` es el de la reserva; `match.status` el de `pending_matches`; `missingPlayers = 4 - jugadores`; el organizador aparece solo como `match`.
- `cancellable = kind=reservation AND status=reserved AND now <= starts_at - 4 h` mediante `playerMayCancel` (`cancel.go`); los partidos nunca.
- Reservas manuales excluidas; canchas y complejos dados de baja siguen apareciendo; canceladas incluidas y clasificadas por su intervalo original.

## Archivos principales

- `backend/internal/reservations/own_list.go`, `own_list_test.go` (unitarias).
- `backend/cmd/api/my_reservations_http_test.go` (HTTP + PostgreSQL real).
- `backend/internal/reservations/service.go` y `backend/cmd/api/routes.go` (ruta).

## Validación

Desde `backend/`, con `TEST_DATABASE_URL` apuntando solo a `padelmatch_test` (PostgreSQL 17 descartable): `go test -count=1 ./...` y `go vet ./...` correctos. Cobertura: 401/400, vacío `items: []`, forma y privacidad, `Cache-Control`, frontera `ends_at == now`, frontera exacta de 4 h, canceladas, aislamiento entre usuarios, manuales, organizador una sola vez, `player`, `missingPlayers`, completo, reserva cancelada de partido, baja lógica, orden con desempate por id y paginación. Sin cambios en las pruebas de HU-06/HU-14/HU-15.

## Límites de alcance

Sin migraciones ni escrituras. No cancela partidos abiertos ni avisa a anotados (HU-14), no cambia la agenda (HU-07), no permite bajarse (HU-13). "Pasado" no implica asistencia.