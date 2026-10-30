# HU-05 backend: consulta pública de disponibilidad

## Alcance implementado

Se implementó la consulta pública `GET /api/v1/complexes/{complexId}/slots?date=AAAA-MM-DD`
según TDD-0009 versión 2. La ruta no requiere JWT y responde `Cache-Control: no-store`.
La fecha debe ser el único parámetro, tener formato `AAAA-MM-DD` y estar entre hoy local
y hoy + 13 días, inclusive, en `America/Argentina/Buenos_Aires`. UUID o fecha inválidos
devuelven `400`; complejo inexistente o inactivo, `404`; fallas de lectura o configuración
inconsistente, `500`.

El repositorio consulta complejo, canchas activas, configuración recurrente y reservas
vigentes dentro de una transacción `REPEATABLE READ`, de solo lectura. Los candidatos de
60/90 minutos se generan desde las franjas configuradas. Las reservas se evalúan usando
sus timestamps persistidos y solapamiento semiabierto: ningún candidato solapado se marca
`AVAILABLE`. Un día deshabilitado conserva los candidatos configurados: ocupaciones
vigentes se muestran como `RESERVED` y el resto como `BLOCKED`; la consulta no habilita
nuevas reservas, cuya validación continúa siendo responsabilidad de HU-06.

La respuesta separa `slots` (candidatos) de `occupiedIntervals` (reservas reales). Una
reserva puede marcar varios candidatos `RESERVED` y aparece una sola vez en la lista de
intervalos. Los cruces de medianoche se proyectan como fragmentos diarios semiabiertos,
con los timestamps originales y visibles, sin modificar ni dividir filas. No se devuelven
identificadores de reserva ni datos personales/de contacto. No se agregaron migraciones.

## Pruebas y validación

Validación realizada el 29/10/2026 con PostgreSQL 17 temporal en Docker, base
`padelmatch_test` y esquema aislado por los helpers existentes. Se aplicaron las
migraciones embebidas 001–005 en los tests. El contenedor usó almacenamiento temporal
`tmpfs`, sin volumen persistente.

- **Pasó:** `TestHTTPPostgresHU05AvailabilityAndMidnightProjection`, con HTTP real vía
  `httptest` y PostgreSQL; verificó GET anónimo, orden de canchas, reserva 18:30–20:00
  reflejada en dos candidatos y una sola ocupación, grilla de 90 minutos sin disponibilidad
  falsa, día deshabilitado, exclusión de reservas canceladas y canchas inactivas, `404`
  para complejo inactivo, `courts: []` sin canchas, errores `400`, privacidad y ambos
  fragmentos de medianoche. Una transacción con lock de cancha y reserva no confirmada
  comprobó que el GET no bloquea ni ve datos sin commit; después del commit, el GET siguiente
  devolvió `RESERVED`. También comparó la reserva de medianoche en PostgreSQL antes/después.
- **Pasó:** validación PostgreSQL de franjas solapadas persistidas: el endpoint falló
  cerrado con `500` y los conteos de franjas y reservas se mantuvieron iguales.
- **Pasó:** `go test -count=1 ./...` con `TEST_DATABASE_URL` apuntando a la base temporal;
  todos los paquetes pasaron, incluidas las pruebas de integración existentes de
  autenticación, complejos, canchas, horarios y reservas.
- **Pasó:** `go vet ./...`.
- **Pasó:** `git diff --check`.
- **Omitido:** ninguno por ausencia de PostgreSQL o `TEST_DATABASE_URL`.

## Pendientes de integración con Angular

Esta entrega cubre disponibilidad backend; no completa HU-05 de punta a punta. Angular
debe consumir UUID reales de complejos/canchas, adaptar los estados API en mayúsculas
(`AVAILABLE`, `RESERVED`, `BLOCKED`) a su modelo visual y definir cómo representar
`occupiedIntervals` junto a las celdas `RESERVED`. Los IDs sintéticos de demostración y
los estados `pending`/`class` no forman parte de este endpoint. No se modificaron Angular
ni los contratos compartidos.
