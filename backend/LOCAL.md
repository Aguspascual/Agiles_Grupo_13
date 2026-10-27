# PostgreSQL local para el backend

Dos instancias independientes de PostgreSQL 17.11: desarrollo persistente y pruebas descartables. No inicia ni modifica el frontend. Requiere Docker Desktop con contenedores Linux, Docker Compose y Go.

## Iniciar y ejecutar

Desde la raíz del repositorio, en PowerShell:

```powershell
. ./backend/scripts/local-env.ps1
docker compose -f backend/compose.postgres.yml up -d --wait postgres-dev
cd backend
go run ./cmd/api
```

El script genera una sola vez contraseñas aleatorias independientes y un secreto JWT de 32 bytes aleatorios (64 caracteres hexadecimales). Los reutiliza sin imprimirlos y carga `DATABASE_URL`, `TEST_DATABASE_URL` y `JWT_SECRET` únicamente en la terminal actual. Repetir la carga en cada terminal nueva. La API aplica las migraciones al iniciar; Compose no modifica su contenido.

## Ejecutar pruebas

Detener la API con `Ctrl+C`. Desde la raíz:

```powershell
. ./backend/scripts/local-env.ps1
docker compose -f backend/compose.postgres.yml --profile test up -d --wait postgres-test
cd backend
go test -count=1 ./...
go vet ./...
```

`TEST_DATABASE_URL` apunta exclusivamente a `padelmatch_test`. Sus pruebas pueden borrar o reconstruir datos: nunca sustituirla por la conexión de desarrollo, compartida o de producción. No ejecutar suites en paralelo contra esta misma instancia.

| Instancia | Acceso local | Almacenamiento |
| --- | --- | --- |
| Desarrollo, `padelmatch` | `127.0.0.1:15432` | Volumen exclusivo `agiles-grupo13-backend-postgres-dev-data` |
| Pruebas, `padelmatch_test` | `127.0.0.1:15433` | `tmpfs`; se pierde al detener el contenedor |

Ambas usan el usuario local `padelmatch`, autenticación SCRAM y zona `America/Argentina/Buenos_Aires`, fijada también en el servidor PostgreSQL. La imagen oficial está fijada por versión y digest. Si un puerto, nombre o volumen ya pertenece a otro entorno, detenerse y comprobar su propietario; no borrar recursos para liberar nombres.

## Detener sin perder desarrollo

Desde la raíz:

```powershell
docker compose -f backend/compose.postgres.yml --profile test stop
```

Para retirar únicamente los contenedores y la red de este proyecto, conservando el volumen de desarrollo:

```powershell
docker compose -f backend/compose.postgres.yml --profile test down
```

No utilizar `down -v`, `volume rm` ni limpiezas globales. Conservar también `backend/.local/`: sus tres archivos están ignorados por Git, pero contienen secretos en texto plano; protegerlos con permisos de usuario y no compartirlos. Compose los monta como archivos secretos, no como contraseñas en variables del contenedor. El JWT no se monta en PostgreSQL.

Si un archivo es inválido, el script falla sin reemplazarlo. Restaurar el secreto original antes de reconectar a un volumen existente: generar otra contraseña no cambia la almacenada en PostgreSQL. Respaldar datos antes de cualquier recuperación manual.

## Alcance y pendientes

Esta preparación permite verificar persistencia e integración reales; no demuestra por sí sola que HU-04 esté terminada. La dependencia de reservas reales sigue pendiente y no debe sustituirse por respuestas ficticias. Las operaciones que dependen de esa integración deben informar su indisponibilidad explícitamente.
