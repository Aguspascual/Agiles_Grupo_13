---
id: "0014"
estado: Aprobado v1
version: 1
autor: "moyanop"
fecha: "2026-10-30"
titulo: "Listado público de complejos"
hu: HU-05
capa: backend
---

# TDD-0014: Listado público de complejos

> Aprobado por el solicitante el 30/10/2026 para su implementación.

## Contexto de Negocio (PRD)

### Objetivo
Permitir que un jugador sin sesión llegue a la grilla pública de turnos (`GET /api/v1/complexes/{complexId}/slots`) eligiendo un club real. Hoy `GET /api/v1/complexes` exige sesión y rol, por lo que el directorio `/clubes` no puede listar complejos reales.

### User Persona
- **Nombre**: jugador anónimo o autenticado.
- **Necesidad**: ver qué clubes existen y abrir la grilla de turnos de uno, sin crear cuenta.

### Criterios de Aceptación
- **CA-01**: un usuario anónimo (sin JWT) accede al listado.
- **CA-02**: un complejo dado de baja (`deleted_at IS NOT NULL`) no aparece.
- **CA-03**: no se filtra información de usuarios: sin teléfono, encargados ni datos personales; solo `id`, `name`, `address`, `zone`.
- **CA-04**: `GET /api/v1/complexes` sigue protegido y sin cambios.

## Diseño Técnico (RFC)

### Modelo de Datos
Sin migraciones ni escrituras. Lectura de `complexes` con los mismos cuatro campos que `slots.Complex`.

### Contrato de API
*   **Endpoint**: `GET /api/v1/public/complexes`
*   **Autenticación**: ninguna (sin JWT, sin body).
*   **Query**: ninguna. Cualquier parámetro de consulta devuelve `400 {"error":"consulta inválida"}`.
*   **Cabecera de respuesta**: `Cache-Control: no-store`.
*   **Response `200 OK`**:
```json
{
  "complexes": [
    { "id": "6ba7b810-9dad-41d1-80b4-00c04fd430c8", "name": "Complejo Norte", "address": "Calle 14 y 501", "zone": "Gonnet" }
  ]
}
```
    Ordenado por `name`, luego `id`. Lista vacía: `{"complexes":[]}` (nunca `null`).

### Componentes del Monolito Modular
*   **Modelo**: reutiliza `slots.Complex`.
*   **Servicio HTTP** (`backend/internal/slots/service.go`): `ListHandler()`, valida la query, reutiliza `writeError` y responde con `Cache-Control: no-store`.
*   **Repositorio** (`backend/internal/slots/postgres.go`): `ListComplexes(ctx) ([]Complex, error)` agregado a la interfaz `Repository`; filtra `deleted_at IS NULL` y ordena por `name, id`.
*   **Rutas** (`backend/cmd/api/routes.go`): registrar la ruta sin `RequireUser`, junto a la de `/slots`, con comentario de que es pública. No se toca `complexes/`.

## Casos de Borde y Errores
| Escenario | Resultado Esperado | Código HTTP |
| --- | --- | --- |
| Sin complejos activos | `{"complexes":[]}` | 200 OK |
| Complejo dado de baja | No aparece en la lista | 200 OK |
| Cualquier parámetro de consulta | `{"error":"consulta inválida"}` | 400 Bad Request |
| Falla del repositorio | Error genérico sin detalles internos | 500 Internal Server Error |
| Sin token | Accede normalmente | 200 OK |
| `GET /api/v1/complexes` sin token | Sigue rechazado | 401 Unauthorized |

## Plan de Implementación
1. Acordar y aprobar criterios y contrato (este documento).
2. Red: pruebas en `slots/service_test.go` (200 ordenado, `[]` vacío, query ⇒ 400, error de repo ⇒ 500), prueba Postgres sobre `padelmatch_test` (excluye dados de baja, sin campos extra) y `cmd/api/routes_test.go` (público sin token; rutas protegidas siguen en 401).
3. Green: `ListComplexes`, `ListHandler` y la ruta.
4. Refactor con pruebas verdes; actualizar `backend/README.md` y `docs/backend/HU-05-implementacion.md`; registrar la evidencia en la PR.
