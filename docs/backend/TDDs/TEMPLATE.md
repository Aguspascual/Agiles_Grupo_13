---
autor: [Nombre]
fecha: [AAAA-MM-DD]
titulo: [Operación y funcionalidad]
---

# TDD-[XXXX]: [Operación y funcionalidad]

## Contexto de Negocio (PRD)

### Objetivo
[Descripción del valor de negocio y qué problema resuelve.]

### User Persona
*   **Nombre**: [Nombre del rol/persona]
*   **Necesidad**: [Descripción de lo que necesita lograr y sus puntos de dolor.]

### Criterios de Aceptación
*   **CA-01**: [El sistema debe validar que...]
*   **CA-02**: [Al finalizar, el sistema debe...]
*   **CA-03**: [El estado por defecto debe ser...]

## Diseño Técnico (RFC)

### Modelo de Datos
[Entidades Go, tablas y migraciones PostgreSQL; vincular RN-XX si corresponde.]
*   `campo`: Tipo (Restricciones).

### Contrato de API
[Contrato de una sola operación: alta, baja, modificación, búsqueda o funcionalidad puntual. DTO JSON acordados con frontend.]
*   **Endpoint**: `METHOD /api/v1/[recurso]`
*   **Request Body**:
```json
{
    "campo": "valor"
}
```
*   **Response**: [Código HTTP y cuerpo JSON completo, o sin cuerpo si corresponde.]

### Componentes del Monolito Modular
[Distribución de responsabilidades dentro del módulo.]
*   **Modelo**: [Entidades, validaciones y reglas de negocio.]
*   **Servicio HTTP**: [Flujo, permisos y manejo de respuestas.]
*   **Repositorio**: [Consultas SQL, transacciones e integridad.]

## Casos de Borde y Errores
| Escenario | Resultado Esperado | Código HTTP |
| --- | --- | --- |
| [Email ya registrado] | [Mensaje claro sin persistencia parcial] | 409 Conflict |
| [Formato email inválido] | [Error de validación de formato] | 400 Bad Request |

## Plan de Implementación
1. [Acordar y aprobar los criterios, reglas y contrato.]
2. [Red: escribir y ejecutar la prueba del criterio.]
3. [Green: implementar modelo, servicio y persistencia mínimos.]
4. [Refactor: mejorar con pruebas verdes y documentar la evidencia en la PR.]
