# HU-08 — Modificación del perfil propio

Implementación de `PUT /api/v1/auth/me` conforme a TDD-0005 versión 1 aprobada.

## Fases

1. **Red:** se añadieron pruebas de handler para autorización, validación estricta,
   actualización del usuario autenticado y borrado de campos opcionales. La primera
   ejecución confirmó que `ProfileUpdateHandler` no existía.
2. **Green:** se reutilizaron la normalización y los catálogos del registro, se añadió
   el handler JWT, el `UPDATE` parametrizado por `user_id` y la ruta PUT.
3. **Refactor:** se extrajo la validación compartida de los cinco campos de perfil,
   conservando validaciones de email, contraseña y fair play en el registro.

## Archivos principales

- `backend/internal/auth/model.go`: DTO completo y validación/normalización compartida.
- `backend/internal/auth/service.go`: autorización, validación de cuerpo y respuestas.
- `backend/internal/auth/postgres.go`: actualización SQL atómica parametrizada.
- `backend/cmd/api/routes.go`: registro de `PUT /api/v1/auth/me`.
- `backend/internal/auth/service_test.go`: pruebas unitarias del contrato y aislamiento.
- `backend/cmd/api/routes_test.go`: prueba HTTP con PostgreSQL descartable.
- `backend/README.md`: contrato y límites de integración.

## Validaciones y resultados

- El DTO rechaza campos desconocidos; punteros distinguen campos omitidos o `null`.
- El decoder estricto rechaza JSON inválido y documentos adicionales.
- Se aplican los mismos catálogos, recorte de espacios y límite de nombre del registro.
- Los campos opcionales vacíos se almacenan como `NULL`; la respuesta mantiene el
  formato de `GET /api/v1/auth/me` y no genera JWT.
- El SQL modifica solo `name`, `zone`, `level`, `position` y `hand`; la identidad se
  toma del `sub` del JWT.
- PostgreSQL temporal: `postgres:17`, servidor `17.11`, base descartable
  `padelmatch_test`, contenedor `hu08-pg17-validation-51rx2wh7`, puerto local
  `53555` y volumen exclusivo `hu08-pg17-data-51rx2wh7`. `TEST_DATABASE_URL` se
  configuró solo en el proceso de tests y apuntó a esa base.
- `go test -count=1 -run TestHTTPPostgresHU08OwnProfileUpdate -v ./cmd/api`: pasó;
  salida `--- PASS: TestHTTPPostgresHU08OwnProfileUpdate`.
- `go test -count=1 ./...`: pasó con PostgreSQL temporal disponible; todos los
  paquetes con tests devolvieron `ok`. `backend/migrations` informó `[no test files]`.
- `go vet ./...`: pasó.
- `git diff --check`: pasó.
- La prueba unitaria `TestRegisterValidationPreservesEmailErrorPrecedence` pasó;
  el registro mantiene el orden de errores que tenía antes de compartir validadores.
- Evidencia de persistencia: el test creó dos usuarios mediante registro, autenticó
  login, ejecutó PUT y comprobó HTTP 200 y los valores guardados en la respuesta;
  GET posterior devolvió los cambios. El segundo usuario conservó su perfil. Las
  entradas inválidas no cambiaron el perfil. El test comparó directamente en
  PostgreSQL email, hash de contraseña, rol y aceptación de fair play antes y después.
  La limpieza de campos opcionales se comprobó mediante PUT y GET.
- Pruebas omitidas: ninguna de las pruebas HU-08; el paquete `backend/migrations` no
  tiene pruebas declaradas.

## Alcance pendiente

La integración con Angular, la visualización en partidos, múltiples zonas y opciones
de privacidad están fuera del TDD-0005. No se modificaron migraciones ni esquemas.
