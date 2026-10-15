# Changelog de desarrollo

## HU-01 backend y PostgreSQL

- Se añadieron registro e inicio de sesión en Go, almacenamiento PostgreSQL de usuarios y perfil, bcrypt y tokens JWT.
- Se agregó una migración inicial idempotente con restricciones para zona, nivel, posición y mano.
- La zona se valida contra los siete valores acordados, con recorte de espacios exteriores. No se crearon `zones` ni `user_zones`.
- Se añadieron pruebas unitarias de validación. Su ejecución queda pendiente: Go/gofmt no están instalados ni disponibles en PATH en el entorno actual.
- El frontend no fue modificado; se inspeccionó la rama de HU-01 solamente mediante `git show`.
