# TDD en backend

**Documento acordado → Red → Green → Refactor → revisión.**

TDD es desarrollo guiado por pruebas. El documento reúne el negocio y el diseño antes de implementar; no sustituye las pruebas ni demuestra por sí solo que se practicó TDD.

## Cómo trabajamos

1. Elegir y coordinar una HU de backend.
2. Copiar [TEMPLATE.md](TEMPLATE.md) a `TDD-XXXX-hu-XX-descripcion.md`, con ID único.
3. Definir criterios verificables, datos, API, permisos, errores y reglas relacionadas.
4. Obtener aceptación humana antes de escribir la implementación.
5. Escribir una prueba que falle por el comportamiento esperado, implementar lo mínimo y refactorizar manteniendo las pruebas verdes.
6. Registrar evidencia en la PR y actualizar el documento si cambia lo acordado.

Un TDD por CRUD cohesivo. Separar funcionalidades como reservar, bloquear, cancelar o reprogramar cuando tengan reglas propias. No separar por archivo o capa técnica ni duplicar especificaciones.

## Verificación

- Pruebas unitarias para reglas y validaciones.
- Pruebas HTTP para contratos y permisos.
- PostgreSQL real para migraciones, integridad, transacciones y concurrencia.
- Comprobar casos de borde y registrar omisiones. Un fallo de configuración no cuenta como Red.

Seguir los [acuerdos backend](../AGENTS_BACK.md) para ramas, commits atómicos, PR y trazabilidad. Consultar solo las [reglas](../../REGLAS-NEGOCIO.md) relacionadas con la tarea.
