---
id: "0005"
estado: Aprobado por el usuario
version: 1
autor: "Equipo backend"
fecha: "2026-10-28"
titulo: "Modificación del perfil propio"
hu: HU-08
capa: backend
trello: "https://trello.com/c/jKLK5qlQ"
---

# TDD-0005: Modificación del perfil propio

> **Versión 1 aprobada por el usuario en la conversación del 28/10/2026.** La coordinación con el equipo y la integración documental siguen pendientes; esta aprobación no es evidencia de un acuerdo histórico del equipo.

## Contexto de Negocio (PRD)

### Objetivo
Permitir que una persona autenticada actualice su perfil de jugador, sin modificar la identidad, credenciales, roles ni asignaciones a complejos.

### User Persona
- **Rol:** jugador con cuenta.
- **Necesidad:** mantener actualizados su categoría, posición y demás datos del perfil.

### Origen y estado de las reglas
- **Criterios de la tarjeta HU-08:** elegir categoría y posición y poder editar el perfil. Mostrar la categoría en partidos pendientes pertenece a otra operación y queda fuera de este TDD.
- **Código existente, no aprobación de un contrato de edición:** registro valida los valores detallados abajo; `GET /api/v1/auth/me` lee el usuario y su perfil. `player_profiles` ya contiene los campos propuestos.
- **Propuestas de este TDD aprobadas por el usuario:** campos editables, PUT completo, normalización, respuesta, errores y manejo de campos vacíos descritos a continuación; no se atribuyen a acuerdos históricos del equipo. Ninguna RN de `docs/REGLAS-NEGOCIO.md` se aplica específicamente a esta edición.

### Criterios de Aceptación
- **CA-01:** solo el titular autenticado modifica su propio perfil; el identificador se obtiene del JWT, no del cuerpo o de la URL.
- **CA-02:** actualizar conjuntamente `name`, `zone`, `level`, `position` y `hand`; una lectura posterior con `GET /api/v1/auth/me` refleja los valores guardados.
- **CA-03:** rechazar entradas inválidas o incompletas sin alterar ningún dato. No modificar ID, email, contraseña, aceptación de fair play, roles ni asignaciones a complejos.
- **CA-04:** conservar el comportamiento de registro, inicio de sesión y lectura de sesión existentes.

## Diseño Técnico (RFC)

### Modelo de Datos
Reutilizar `player_profiles` por `user_id` y `users` para construir la respuesta. No se propone migración ni tabla nueva. Un único `UPDATE` parametrizado modifica solo los cinco campos permitidos; las validaciones se realizan antes de persistir. No se crea un perfil faltante automáticamente.

Aplicar la normalización del registro (quitar espacios extremos) y sus valores actuales:
- `name`: no vacío, máximo 120 bytes, como el `len` actual de Go.
- `zone`: `Casco Urbano`, `Gonnet`, `City Bell`, `San Carlos`, `Tolosa`, `Villa Elisa` o `Berisso / Ensenada`.
- `level`: `Principiante`, `8va`, `7ma`, `6ta`, `5ta`, `4ta`, `3ra`, `2da` o `1ra`.
- `position`: `Drive`, `Revés`, `Indistinto` o cadena vacía para borrar el valor opcional.
- `hand`: `Diestro`, `Zurdo` o cadena vacía para borrar el valor opcional.

### Contrato de API
- **Endpoint:** `PUT /api/v1/auth/me`; `Authorization: Bearer <JWT>` y `Content-Type: application/json`.
- **Request:** los cinco campos son obligatorios y de tipo cadena, incluso los opcionales al borrar; `null`, omisiones, campos desconocidos y JSON adicional son inválidos. No aceptar identidad ni campos de seguridad en el cuerpo.

```json
{
  "name": "Ana Pérez",
  "zone": "Gonnet",
  "level": "6ta",
  "position": "Drive",
  "hand": "Diestro"
}
```

- **Respuesta `200 OK`:** mismo formato de `GET /api/v1/auth/me`; no emite ni renueva el token. `position` y `hand` se omiten cuando están vacíos, conforme al modelo actual.

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Ana Pérez",
    "email": "ana@example.com",
    "zone": "Gonnet",
    "level": "6ta",
    "position": "Drive",
    "hand": "Diestro"
  }
}
```

### Componentes del Monolito Modular
- **Modelo:** reutilizar las mismas reglas de valores del registro sin obligar a enviar contraseña ni aceptación de fair play; preservar su comportamiento.
- **Servicio HTTP:** autenticar antes de editar, validar el cuerpo estricto y mapear errores sin revelar datos sensibles.
- **Repositorio:** actualizar por `user_id` del JWT con SQL parametrizado y obtener los datos actuales para la respuesta. Una falla no debe dejar una edición parcial; propagar el contexto de la petición.
- **Rutas:** agregar únicamente el método PUT al recurso de sesión existente; no cambiar la lectura GET.

## Casos de Borde y Errores
Todos los errores usan `{"error":"..."}`; los mensajes exactos se definirán con el contrato revisado.

| Escenario | Resultado esperado | HTTP |
| --- | --- | --- |
| Sin token, token inválido o usuario/perfil inexistente | Sin cambios; coherente con la lectura de sesión actual | 401 |
| Cuerpo incompleto, `null`, campo extra, JSON inválido o valor fuera del catálogo | Sin cambios | 400 |
| Cadena vacía en posición o mano | Eliminar ese valor opcional, conservar el resto enviado | 200 |
| Falla de persistencia | Sin cambios parciales, error sin detalles internos | 500 |

## Plan de Implementación y verificación propuesto
1. Registrar la aprobación humana de esta versión y coordinar responsable backend y revisión con frontend y equipo de los campos, PUT completo, borrado de opcionales y errores. Si se cambia el contrato, obtener nueva aceptación antes de implementar esa parte.
2. Aplicar Red → Green → Refactor. Pruebas de dominio solo para las validaciones relevantes, reutilizando las existentes cuando corresponda; no exigir pruebas por archivo.
3. Integración útil mediante HTTP y PostgreSQL descartable: edición y lectura posterior (CA-02), rechazo sin cambios (CA-03), identidad del token y aislamiento entre dos usuarios (CA-01), incluidos campos protegidos. Verificar limpieza de opcionales y perfil ausente sin alta implícita.
4. Verificar regresión de registro, login y sesión (CA-04); ejecutar desde `backend/` `go test -count=1 ./...` y `go vet ./...`. Informar si PostgreSQL o cualquier prueba no está disponible; una omisión no demuestra persistencia.

## Dependencias y límites
- La autenticación y las tablas usadas existen en `origin/Desarrollo` `92e739e`; su funcionamiento con PostgreSQL no se volvió a ejecutar durante este borrador.
- No depende de reservas o partidos. Su consumo por frontend y la visualización en partidos quedan fuera de esta operación.
- No se modifica frontend, Docker, dependencias ni reglas compartidas. La versión 1 fue aprobada por el usuario; la coordinación del equipo y su integración siguen pendientes.
