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
| [0001: alta de un día](TDD-0001-hu-04-alta-horario-diario.md) | HU-04 | Borrador |

### HU-04: acuerdos y contrato común propuesto

**Dependencia documental:** `docs/acuerdos-backend-tdd`. Integrar los acuerdos generales en `Desarrollo` antes de solicitar la integración de estos TDD. Esta rama no implementa la funcionalidad.

Las reglas acordadas de HU-04 son RN-09 a RN-15: unidad por día, protección de reservas, franjas sin cruce de medianoche, permisos, deshabilitación sin cancelar reservas, baja sin reservas futuras y duración de 60 o 90 minutos para nuevas reservas. Los contratos siguen en borrador: no implementar hasta revisar y aprobar cada TDD. Sustituyen la propuesta de reemplazar toda la semana.

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

Los casos consultados de negocio quedan definidos en RN-09 a RN-15. Reducir una franja dejando una reserva fuera del horario se rechaza; deshabilitar o cambiar la duración para nuevas reservas no altera las existentes. Pendientes antes de implementar: revisión humana de criterios, modelo, contratos HTTP y su integración con frontend y reservas. Los contratos técnicos siguen propuestos; acordar reglas no equivale a aprobar la implementación.
