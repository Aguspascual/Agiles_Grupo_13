---
id: "0001"
estado: Borrador
version: 1
autor: "Pedro Moyano Amaya"
fecha: "2026-10-22"
titulo: "CRUD de horarios recurrentes por cancha"
hu: HU-04
capa: backend
trello: "https://trello.com/c/PfnE8VXU"
aprobado_por: []
fecha_aprobacion: null
evidencia_aprobacion: null
---

# TDD-0001: CRUD de horarios recurrentes por cancha

> **Borrador.** Los contratos y modelos siguientes requieren aceptación del equipo backend antes de implementarse.

## Contexto de Negocio (PRD)

### Objetivo

Guardar la configuración semanal de cada cancha en PostgreSQL para compartir disponibilidad entre navegadores y preparar la grilla de HU-05. Hoy la interfaz HU-04 guarda sus reglas localmente.

### User Persona

- **Nombre / rol:** encargado de un complejo.
- **Necesidad:** consultar, cargar, editar y quitar intervalos semanales de sus canchas sin afectar reservas existentes ni operar canchas de otro complejo.

### Alcance

- Incluye CRUD de configuración semanal por cancha: consulta y reemplazo completo de intervalos, que permite agregar, editar y quitar intervalos en una operación atómica.
- No incluye reservas, grilla pública HU-05, bloqueos puntuales, vencimiento de partidos ni reprogramación. Bloqueos y consulta/calculo de turnos tendrán TDD propios con sus contratos.
- Dependencias: HU-01/HU-02/HU-03 backend integradas y verificadas en `Desarrollo`; autorización efectiva por complejo.
- HU-04 completa **no se termina solo con este TDD**: también requiere los bloqueos puntuales pedidos en Trello y su integración frontend.

### Criterios de Aceptación propuestos

- **CA-01:** el encargado asignado consulta y modifica únicamente la configuración de canchas activas de su complejo activo. Confirmar si ADMIN también opera esta configuración.
- **CA-02:** cada día admite intervalos válidos no superpuestos y duración de turno de 60 o 90 minutos, alineado con la interfaz actual. Precisar límites nocturnos antes de aprobar.
- **CA-03:** un reemplazo inválido no modifica parcialmente la configuración anterior.
- **CA-04:** los cambios no alteran reservas existentes sin el consentimiento de [RN-06](../../REGLAS-NEGOCIO.md). La comprobación real de reservas es una dependencia bloqueante.
- **CA-05:** dos navegadores ven la misma configuración persistida. Antes de aprobar, elegir cómo detectar dos ediciones concurrentes para no perder cambios silenciosamente.

## Diseño Técnico (RFC) propuesto

### Modelo de Datos

Entidad Go de configuración por cancha, con `courtID`, revisión y reglas semanales. Tabla(s) PostgreSQL e índice por cancha/día a definir al revisar; todavía **no se asigna un número de migración**.

- `court_id`: UUID, FK a la cancha existente.
- `weekday`: entero, lunes 1 a domingo 7, a confirmar con frontend.
- `duration_minutes`: 60 o 90, definir si aplica por día o por intervalo.
- Intervalos: apertura/cierre en hora local del complejo; validación de formato y no superposición.
- `revision`: propuesta para evitar sobreescrituras concurrentes; acordar contrato y restricción antes de implementar.
- Sustituir toda la configuración dentro de una transacción. La estrategia para proteger reservas debe acordarse con ese módulo, no inventarse aquí.

### Contrato de API propuesto

- `GET /api/v1/complexes/{complexId}/courts/{courtId}/weekly-schedule`.
- `PUT /api/v1/complexes/{complexId}/courts/{courtId}/weekly-schedule`: reemplazo completo; elimina intervalos omitidos solo si el documento aprobado lo permite.
- Requiere JWT y pertenencia al complejo. Los nombres, cuerpo y códigos de éxito quedan a revisar con frontend antes de aceptar este documento.
- Request tentativo:

```json
{
  "revision": 0,
  "rules": [
    {
      "weekday": 1,
      "enabled": true,
      "durationMinutes": 90,
      "intervals": [{ "opensAt": "08:00", "closesAt": "12:30" }]
    }
  ]
}
```

### Componentes del Monolito Modular

- Agregar un módulo de horarios junto a `auth`, `complexes` y `courts`, siguiendo sus convenciones; nombre a acordar.
- Modelos/validación, servicio HTTP y repositorio PostgreSQL pequeños; rutas compuestas en `cmd/api`.
- Reutilizar autenticación y comprobación real de pertenencia, sin copiar el selector de roles de demostración del frontend.

## Casos de Borde y Errores propuestos

| Escenario | Resultado esperado | HTTP propuesto |
| --- | --- | --- |
| Sin JWT | Rechazo sin cambios | 401 |
| Encargado ajeno | Rechazo sin cambios | 403; acordar si se oculta existencia con 404 |
| Cancha/complejo inexistente o inactivo | No modificar datos | 404 |
| Intervalos superpuestos o duración inválida | Mantener configuración previa | 400 |
| Revisión desactualizada | No sobrescribir cambios del otro encargado | 409 |
| Cambio que afecta reservas sin consentimiento | No aplicar el cambio | 409; concretar tras definir reservas |
| Error PostgreSQL | Rollback y error, sin éxito parcial | 500 / 503, por acordar |

## Plan de Pruebas e Implementación

1. Cerrar las preguntas y aprobar el documento con el otro compañero de backend.
2. Red/Green de CA-02 con casos de solapamiento, duración y límites de horario.
3. Red/Green HTTP de CA-01 y errores de autenticación/recursos.
4. Red/Green PostgreSQL de CA-03 y CA-05: persistencia, reemplazo atómico y edición concurrente.
5. Probar CA-04 con fuente de reservas real cuando esté disponible; no declararlo cumplido con un fake únicamente.
6. Refactor, suite relevante y contrato frontend. Commits por comportamiento probado.

## Pendientes para aprobar

- Aprobación del revisor y dependencias integradas.
- Días deshabilitados, límite de intervalos, horarios que cruzan medianoche y alcance de cambios en reservas.
- Modelo SQL, contrato GET/PUT, semántica de revisión y estrategia contra pérdida de actualizaciones.
- ADMIN, formato de errores y plan de recuperación de migraciones.
- Decidir si esta entrega puede hacerse parcial sin CA-04: en ese caso ajustar alcance/criterios **antes de aprobar**, no omitir la garantía silenciosamente.

No se ejecutaron ciclos Red/Green para esta propuesta. No hay aprobación ni implementación asociadas.
