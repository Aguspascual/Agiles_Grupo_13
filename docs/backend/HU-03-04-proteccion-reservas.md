# Protección de reservas en canchas y horarios

## Alcance

Conecta los verificadores de baja de cancha, baja de día y modificación de franjas con `reservations` en PostgreSQL. Protege reservas `reserved` futuras y en curso sin alterarlas. Las reservas canceladas o finalizadas no bloquean. La consulta se realiza dentro de la transacción que bloquea la cancha, coordinada con la creación de reservas de HU-06.

El día de la semana y las franjas se interpretan en `America/Argentina/Buenos_Aires`. La deshabilitación y el cambio de duración mantienen el intervalo real de las reservas existentes. Los errores de consulta no se convierten en éxito.

## Fases y archivos principales

1. Documentación: TDD-0011 y adendas a TDD-0002 y TDD-0003, integradas por la PR #20.
2. Pruebas Red: casos PostgreSQL de reservas futuras, en curso, finalizadas y canceladas, y cambios de horarios con o sin reservas.
3. Implementación: `internal/courts/reservations.go` y `internal/schedules/reservations.go`, conectados a sus repositorios existentes.
4. Verificación: pruebas de dominio y persistencia, HTTP, carreras, `go test -count=1 ./...` y `go vet ./...`; ejecución PostgreSQL mediante base descartable `padelmatch_test`.

### Resultados observados

- `go test -count=1 ./...`: pasó con `TEST_DATABASE_URL` apuntando a PostgreSQL descartable.
- `go vet ./...`: pasó.
- Ejecución detallada de la suite: sin pruebas omitidas; el paquete `migrations` no contiene pruebas propias.
- Las carreras cubren creación de reserva frente a baja de cancha, baja de día y modificación de franjas; cada ejecución comprueba que no se confirme un estado incompatible.
- `go test -race` focalizado: no disponible; `CGO_ENABLED=0` y no hay compilador `gcc` instalado. Las pruebas concurrentes anteriores sí se ejecutaron sin el detector de carreras de Go.
- Verificación independiente en copia temporal: `go test -count=1 ./...` y `go vet ./...` pasaron con PostgreSQL descartable.
- Ambos órdenes de cada carrera se comprobaron de forma determinista con bloqueos PostgreSQL. Los verificadores de cancha y horario se probaron con reservas cuyo fin coincide exactamente con el instante de consulta y con un fin un microsegundo posterior.

## Límites

Este trabajo no implementa disponibilidad, bloqueos puntuales, agenda, cancelaciones, frontend ni Docker. Tampoco agrega migraciones ni cierra todos los criterios de HU-03 o HU-04. La disponibilidad y representación visual se coordinan por separado.
