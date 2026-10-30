# TDD en backend

**Documento acordado → Red → Green → Refactor → revisión.**

TDD es desarrollo guiado por pruebas. El documento reúne el negocio y el diseño antes de implementar; no sustituye las pruebas ni demuestra por sí solo que se practicó TDD.

## Cómo trabajamos

1. Elegir y coordinar una HU de backend.
2. Copiar [TEMPLATE.md](TEMPLATE.md) a `TDD-XXXX-hu-XX-operacion-descripcion.md`, con ID único por operación.
3. Definir criterios verificables, datos, permisos, reglas y el contrato completo: endpoint, request, response y errores. Consultar las decisiones faltantes antes de cerrar el documento.
4. Obtener aceptación humana antes de escribir la implementación.
5. Escribir una prueba que falle por el comportamiento esperado, implementar lo mínimo y refactorizar manteniendo las pruebas verdes.
6. Registrar evidencia en la PR y actualizar el documento si cambia lo acordado.

Un archivo para **alta**, otro para **baja**, otro para **modificación** y otro para **búsqueda**, cuando correspondan a la funcionalidad. No agrupar el CRUD completo. Reservar, bloquear, cancelar o reprogramar también tienen documentos propios. Cada operación se acuerda antes de implementarla; referenciar el modelo común sin duplicar especificaciones.

## Verificación

- Pruebas unitarias para reglas y validaciones.
- Pruebas HTTP para contratos y permisos.
- PostgreSQL real para migraciones, integridad, transacciones y concurrencia.
- Comprobar casos de borde y registrar omisiones. Un fallo de configuración no cuenta como Red.

Seguir los [acuerdos backend](../AGENTS_BACK.md) para ramas, commits atómicos, PR y trazabilidad. Consultar solo las [reglas](../../REGLAS-NEGOCIO.md) relacionadas con la tarea.

## Documentos

| TDD | HU | Estado |
| --- | --- | --- |
| [0001: alta de un día](TDD-0001-hu-04-alta-horario-diario.md) | HU-04 | Aprobado v1 |
| [0002: baja de un día](TDD-0002-hu-04-baja-horario-diario.md) | HU-04 | Aprobado v1 |
| [0003: modificación de un día](TDD-0003-hu-04-modificacion-horario-diario.md) | HU-04 | Aprobado v1 |
| [0004: búsqueda de horarios](TDD-0004-hu-04-busqueda-horarios.md) | HU-04 | Aprobado v1 |
| [0011: baja de cancha](TDD-0011-hu-03-baja-cancha.md) | HU-03 | Aprobado v1 |
| [0012: alta de reserva manual](TDD-0012-hu-15-alta-reserva-manual.md) | HU-15 | Borrador v1 para aprobación humana |
| [0013: consulta de reservas y partidos propios, próximos y jugados](TDD-0013-hu-17-consulta-reservas-propias.md) | HU-17 | Borrador para aprobación humana (v2) |
| [0014: listado público de complejos](TDD-0014-hu-05-listado-publico-complejos.md) | HU-05 | Aprobado v1 |
| [0009: consulta pública de disponibilidad de turnos](TDD-0009-hu-05-consulta-publica-disponibilidad-turnos.md) | HU-05 / HU-09 | v2 aprobado; v3 (partido abierto en la grilla) borrador para aprobación humana |
| [0010: cancelación de una reserva (jugador)](TDD-0010-hu-14-cancelacion-reserva.md) | HU-14 | Borrador v3 para aprobación humana |
| [0015: consulta de la agenda del complejo](TDD-0015-hu-07-consulta-agenda-complejo.md) | HU-07 | Borrador v2 para aprobación humana |
| [0016: cancelación de una reserva por el encargado](TDD-0016-hu-07-cancelacion-por-encargado.md) | HU-07 | Borrador v1 para aprobación humana |

### HU-04: acuerdos y contrato común aprobado

**Dependencia documental integrada:** acuerdos backend y TDD recurrentes incorporados en Desarrollo. La aprobación técnica v1 se registró en esta conversación el 27/10/2026; no implica aprobar contratos de funcionalidades adicionales.

Las reglas acordadas de HU-04 son RN-09 a RN-15: unidad por día, protección de reservas, franjas sin cruce de medianoche, permisos, deshabilitación sin cancelar reservas, baja sin reservas futuras y duración de 60 o 90 minutos para nuevas reservas. Los contratos v1 fueron aprobados explícitamente en la conversación del 27/10/2026. Sustituyen la propuesta de reemplazar toda la semana.

- Un día reúne sus franjas y una duración de turno común. Bloqueos por fecha, grilla de turnos HU-05 y reprogramación quedan fuera; requieren TDD propios. Estos TDD no completan toda HU-04.
- Dependencias: autenticación HU-01, complejos HU-02 y canchas HU-03 integrados y verificados; rol y pertenencia del encargado al complejo comprobados en backend. No usar roles de demostración del frontend.
- API propuesta: `/api/v1/complexes/{complexId}/courts/{courtId}/weekly-schedule/days`; IDs de complejo/cancha UUID y día `1..7` (lunes a domingo). Cada TDD define su método y cuerpo.
- JWT en `Authorization: Bearer <token>`; acceso al encargado asignado al complejo y al administrador general (RN-12). El administrador general no necesita asignación al complejo; los demás roles no acceden. Se proponen recursos activos como requisito. Esta búsqueda es administrativa, no la disponibilidad pública de HU-05.
- Deshabilitar se realiza mediante modificación: cambiar `enabled` a `false` conservando franjas y duración; reactivar usa `true`. Se permite con reservas futuras: impide nuevas reservas, pero las existentes se juegan sin alteraciones (RN-13). La baja elimina la configuración y requiere alta posterior; se rechaza si hay reservas futuras vigentes, incluso si el día está deshabilitado (RN-15).
- Cambiar de 60 a 90 minutos, o viceversa, solo cambia la duración para nuevas reservas; las existentes conservan inicio, fin y duración (RN-14). Su duración no debe recalcularse desde la configuración actual. Disponibilidad y confirmación de reservas deben impedir solapamientos por el intervalo real ocupado; verificarlo con integración, no solo con mocks.
- Request JSON estricto en POST/PUT: rechazar campos desconocidos, tipos inválidos o campos obligatorios ausentes. Errores JSON `{"error":"mensaje"}`, siguiendo el formato existente.
- Errores comunes propuestos: `400` entrada inválida, `401` sin autenticación válida, `403` sin permiso, `404` recurso inexistente/inactivo, `500` fallo interno sin datos sensibles. Comprobar autorización antes de devolver horarios.
- Concurrencia propuesta: cada día devuelve `revision` UUID opaca, nueva en cada alta/modificación. Alta, modificación y búsqueda individual incluyen `ETag: "<revision>"`; la búsqueda semanal incluye las revisiones en cada día. PUT/DELETE exigen `If-Match: "<revision>"`; `428` si falta, `400` si es inválida y `412` si quedó desactualizada. Comparar y escribir en una operación atómica. Una recreación no reutiliza revisiones anteriores.
- Horas locales `HH:mm` dentro del mismo día, sin convertir horas recurrentes a UTC; interpretar cada fecha con `America/Argentina/Buenos_Aires` (RN-07 y RN-11). El frontend debe coordinar el nuevo contrato por día; no se modifica en esta entrega.

Los casos consultados de negocio quedan definidos en RN-09 a RN-15. Reducir una franja dejando una reserva fuera del horario se rechaza; deshabilitar o cambiar la duración para nuevas reservas no altera las existentes. La integración con frontend y reservas reales sigue pendiente. La aprobación técnica v1 se registró en la conversación del 27/10/2026; no implica completar los criterios que dependen de reservas reales.
