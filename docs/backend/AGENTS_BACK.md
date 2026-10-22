# Acuerdos de desarrollo backend

## Alcance

- El equipo backend desarrolla la API en Go, la persistencia PostgreSQL y sus pruebas dentro del monolito modular existente.
- Definir y mantener contratos de API claros: request, response, validaciones y errores. No modificar código ajeno al alcance autorizado.
- Para una tarea, leer este archivo, el TDD correspondiente y las reglas de negocio que lo afecten. Consultar otros documentos solo cuando sean necesarios.
- Mantener trazabilidad **HU → TDD → criterios/reglas → pruebas → código → PR**.
- No implementar supuestos ni cambiar acuerdos de negocio sin aceptación del equipo.

## Flujo de trabajo y TDD

1. Elegir una HU de Sprint 2 o En proceso en Trello, registrarse como miembro de la tarjeta y avisar por el grupo. Coordinar su responsabilidad backend para evitar duplicados y mantener la misma identificación de HU en tarjeta, documentación, commits y PR.
2. Crear un documento desde [TEMPLATE.md](TDDs/TEMPLATE.md) por operación: alta, baja, modificación y búsqueda van en TDD separados. Las funcionalidades puntuales también tienen su propio TDD.
3. Acordar criterios de aceptación, modelo, API, permisos, errores, transacciones y pruebas antes de programar. El TDD comienza como borrador.
4. Obtener aprobación humana del documento y registrar la versión aceptada en la PR o conversación vinculada. Un agente no se autoaprueba.
5. Trabajar con **Red → Green → Refactor**: prueba que falla por el comportamiento faltante, implementación mínima y mejora con pruebas verdes.
6. Entregar unidades pequeñas con código, pruebas y documentación coherentes; pedir revisión a otro integrante del equipo backend.

Si cambia una regla o contrato aprobado, actualizar el TDD y obtener nueva aceptación antes de continuar esa parte. La aprobación del documento no sustituye la revisión del código.

Cada TDD define una operación completa: criterios, reglas aplicables, datos, permisos, endpoint, request, response, errores y pruebas. Partir de Trello y las reglas documentadas; consultar las decisiones faltantes antes de cerrar el contrato. No agrupar todo el CRUD en un documento ni dejar decisiones de negocio al agente que implemente. Compartir referencias al modelo común sin duplicar acuerdos.

Los criterios deben tener identificadores como `CA-01`; referenciar `RN-XX` de [REGLAS-NEGOCIO.md](../REGLAS-NEGOCIO.md) cuando corresponda. Las pruebas deben permitir identificar qué criterio verifican. Registrar comandos y resultados en la PR, sin fabricar una fase Red retrospectiva.

[Introducción a TDD en backend](TDDs/README.md).

## Implementación e integración

- Seguir la organización del módulo existente: modelos/validaciones, servicio HTTP, repositorio SQL y composición de rutas en `cmd/api`.
- Usar consultas parametrizadas, permisos por recurso y complejo, contextos con cancelación y transacciones para operaciones indivisibles.
- Versionar migraciones y respetar datos existentes. No sustituir comprobaciones reales por respuestas ficticias para completar una HU.
- Documentar endpoints `/api/v1/...`, DTO JSON, autenticación, códigos HTTP y ejemplos suficientes para consumir la API.
- Probar reglas, errores, permisos y persistencia. Los cambios de SQL y concurrencia requieren pruebas con PostgreSQL real, además de las unitarias.

Desde `backend/`:

```powershell
go test -count=1 ./...
go vet ./...
```

Las pruebas con `TEST_DATABASE_URL` deben apuntar a una base descartable de pruebas, nunca compartida o de producción. Un test omitido no demuestra integración. Informar resultados como **pasó, falló, omitido o no disponible**, con su motivo.

## Ramas

- Base: `Desarrollo` actualizado. No crear una rama nueva desde la de otro integrante.
- Ramas de funcionalidad: `feature/descripcion`, por ejemplo `feature/horarios-disponibles`.
- Usar minúsculas y guiones, sin espacios, tildes ni `ñ`. No incluir `HU-XX` ni la capa en las nuevas ramas de funcionalidad.
- La HU se mantiene en los commits y en el título de la PR; describir la misma historia en Trello y documentación. Las ramas ya existentes conservan su nombre.
- Separar acuerdos, metodología y reglas compartidas en una rama `docs/...`, por ejemplo `docs/acuerdos-backend-tdd`; los TDD de una HU van en su propia rama documental, por ejemplo `docs/hu-04-tdd-horarios`.
- Si una dependencia no está integrada en `Desarrollo`, coordinar su integración antes de comenzar la rama dependiente.
- Actualizar la rama de trabajo y volver a probar antes de pedir revisión. No subir cambios directamente a `Desarrollo` ni descartar trabajo para resolver divergencias.

## Commits atómicos

Formato: `HU-XX: verbo en infinitivo + qué se hizo`.

- Español, minúscula después de los dos puntos, sin punto final y hasta 72 caracteres en el asunto.
- Sin HU: `docs:`, `chore:` o `fix:`. Explicar el porqué en el cuerpo cuando haga falta.
- Un propósito por commit, no uno por archivo ni un cambio gigante al final.
- Mantener juntas implementación, pruebas y documentación del comportamiento; incluir su migración cuando sea necesaria para que la unidad funcione.
- Cada commit debe ser comprensible y reversible sin afectar trabajo ajeno. Publicar unidades verificadas; la evidencia Red no exige publicar un commit con tests rotos.
- Revisar el diff antes de confirmar. No incluir secretos, archivos `.env`, dependencias descargadas, binarios ni configuración local ajena al cambio.

Ejemplos:

```text
HU-04: validar intervalos de horarios por cancha
HU-03: corregir la baja de canchas con reservas futuras
docs: actualizar acuerdos de desarrollo backend
```

## Pull Requests

- Base siempre `Desarrollo`; título `HU-XX (back): nombre de la historia`, por ejemplo `HU-04 (back): configurar horarios disponibles`.
- Abrir como borrador si falta trabajo. Solicitar al menos una aprobación de otro integrante backend; el autor no se aprueba su PR.
- El reviewer prueba los pasos indicados y contrasta criterios, TDD y reglas. Los cambios pedidos se realizan en la misma rama.
- Antes de integrar: resolver conflictos, pasar los checks pertinentes y dejar claros los pendientes. No declarar una HU completa si falta un comportamiento requerido.
- Con aprobación y validaciones correctas, el reviewer asignado integra mediante **Create a merge commit**. El autor no integra su propia PR. Después, eliminar la rama cuando no queden dependientes y vincular la PR con la tarjeta de Trello.
- No hacer commit, push, comentarios/reviews en GitHub, merge ni cambios en Trello automáticamente: requieren autorización explícita.
- Los hallazgos de revisión quedan en el chat; se publican en una PR solo con autorización. No acumular informes de revisión en el repositorio.

### Descripción de PR

Completar todas las secciones; usar «No aplica» cuando corresponda.

````markdown
## Historia de usuario
Tarjeta de Trello: (link)
TDD y versión aprobada: (link)
Criterios que cubre:
- [ ] (criterio de la tarjeta / TDD)

## Qué cambia
- (endpoints, tablas o componentes)

## Cómo probarlo
1. (pasos, datos, permisos y comandos)
Resultados: (pasó / falló / omitido / no disponible)
Commit verificado: (SHA)

## Capturas
(backend: ejemplo de pedido y respuesta, sin secretos)

## Pendiente o dependencias
(integraciones o comportamientos pendientes)

## Antes de pedir revisión
- [ ] Rama actualizada con Desarrollo y sin conflictos
- [ ] Compila y pasan los tests relevantes
- [ ] Integración PostgreSQL verificada, u omisión declarada
- [ ] Sin claves, .env ni archivos innecesarios
- [ ] Documentación actualizada y coherente con el TDD aprobado
- [ ] Reviewer backend solicitado
````
