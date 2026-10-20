# Changelog de desarrollo

## HU-01 backend y PostgreSQL

- Se añadieron registro e inicio de sesión en Go, almacenamiento PostgreSQL de usuarios y perfil, bcrypt y tokens JWT.
- Se agregó una migración inicial idempotente con restricciones para zona, nivel, posición y mano.
- La zona se valida contra los siete valores acordados, con recorte de espacios exteriores. No se crearon `zones` ni `user_zones`.
- Se añadieron pruebas unitarias de validación. Su ejecución queda pendiente: Go/gofmt no están instalados ni disponibles en PATH en el entorno actual.
- El frontend no fue modificado; se inspeccionó la rama de HU-01 solamente mediante `git show`.

## HU-03 canchas

- Se agregó el CRUD de canchas por complejo en Go. Solo ADMIN y encargados asignados al complejo activo pueden consultar o modificar sus canchas; los complejos dados de baja no son accesibles.
- La migración `003_courts.sql` agrega canchas con baja lógica, características booleanas y claves foráneas restrictivas. La imagen opcional acepta PNG, JPEG o WebP decodificable, con límite de 5 MiB y dimensiones acotadas.
- La baja se rechaza con `503` porque todavía no hay una fuente real de reservas para comprobar turnos futuros de forma segura. El punto de extensión revisa reservas dentro de la misma transacción que marca la cancha como inactiva.
- Verificación: `go test ./...` pasó. La prueba PostgreSQL de HU-03 es optativa y se omite si `TEST_DATABASE_URL` no está configurada.
