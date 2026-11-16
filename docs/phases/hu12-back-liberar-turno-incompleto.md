# HU-12 · Liberar turno de partido incompleto

## Fase 1: reglas y persistencia

- Se considera vencido un partido abierto cuando su turno comienza en menos de cuatro horas. En el instante exacto de cuatro horas todavía permanece protegido.
- Al vencer, la reserva pasa a `cancelled` y el partido a `cancelled` en una sola transacción.
- Se crea un aviso interno `match_cancelled` para cada jugador registrado, incluido quien organizó el partido.
- Los registros se conservan para que los avisos sigan disponibles; la reserva cancelada deja de ocupar el turno.

## Fase 2: liberación y concurrencia

- El trabajador de expiración de la API revisa partidos incompletos cada 10 segundos y también ejecuta una revisión al iniciar.
- La creación de una reserva o de otro partido abierto vuelve a revisar los partidos vencidos de esa cancha dentro de su transacción. Así el turno no depende de esperar al siguiente ciclo del trabajador.
- La consulta de disponibilidad deja de marcar como ocupado un partido abierto que ya cruzó el umbral, por lo que un grupo completo puede ver el turno libre de inmediato.
- Se mantiene el orden de bloqueo existente: complejo, cancha, reserva y partido.

## Archivos principales

- `backend/internal/reservations/incomplete_matches.go`: expiración, liberación y avisos.
- `backend/internal/reservations/full_matches_http.go`: ciclo periódico compartido con HU-16.
- `backend/internal/reservations/postgres.go` y `backend/internal/matches/postgres.go`: revisión atómica antes de crear reservas.
- `backend/migrations/015_incomplete_match_release.sql`: estados y tipos de aviso admitidos.
- `frontend/src/app/matches/match-api.model.ts`, `match-api.mapper.ts` y `frontend/src/app/landing/landing-header.component.ts`: lectura y presentación del nuevo aviso.

## Validación y alcance

- Compilación Go y build Angular completados en la reconstrucción Docker.
- Stack `agiles_grupo_13` reiniciado; frontend, backend y base de datos quedaron saludables.
- No se ejecutó la suite de tests.
- La notificación queda persistida en el centro de avisos de la aplicación; no se envían correos, WhatsApp ni notificaciones push.
- El turno liberado queda disponible para la reserva normal de un grupo completo. No se agregan cobros ni flujos de reserva fuera de los existentes.
