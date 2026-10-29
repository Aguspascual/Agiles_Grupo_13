# PádelMatch con Docker Compose

Esta guía levanta PostgreSQL 17, la API Go y el frontend Angular. La API aplica automáticamente las migraciones al iniciar. Cada computadora mantiene su propia base y volumen local.

> **Dependencia de ramas:** la configuración se desarrolló desde `Desarrollo`, que aún no contiene el backend. Para levantar el stack completo, primero deben integrarse los PR #2, #3 y #4. La validación de esta configuración se realizó en una rama local temporal que reunió esta configuración y el backend HU-03.

## Requisitos

- Docker Desktop iniciado y Docker Compose v2 (`docker compose`).
- Windows PowerShell.

## Clonar y actualizar Desarrollo

```powershell
git clone https://github.com/Aguspascual/Agiles_Grupo_13.git
Set-Location Agiles_Grupo_13
git switch Desarrollo
git pull --ff-only origin Desarrollo
```

Cuando la configuración Docker se integre, actualizá la rama como arriba. El backend debe estar integrado para que exista `backend/cmd/api`.

## Generar variables locales

```powershell
.\scripts\setup-local.ps1
```

El script crea `.env` una sola vez, con una contraseña PostgreSQL y un `JWT_SECRET` de 32 bytes aleatorios cada uno. No imprime los secretos ni reemplaza un `.env` existente. `.env` está excluido de Git. No uses `.env.example` como archivo de ejecución: contiene marcadores de ejemplo.

## Construir e iniciar

```powershell
docker compose up -d --build
```

Compose publica los puertos solo en `127.0.0.1`:

- Frontend: <http://127.0.0.1:8081>
- API: <http://127.0.0.1:8000/health>
- PostgreSQL: `127.0.0.1:5433`

El backend se conecta internamente a `db:5432`, espera que PostgreSQL pase su healthcheck y después aplica las migraciones 001, 002 y 003. El volumen `postgres-data` conserva la base al detener o recrear los contenedores.

## Comprobar los tres servicios

```powershell
docker compose ps
Invoke-WebRequest http://127.0.0.1:8000/health -Method Get
Invoke-WebRequest http://127.0.0.1:8081/ -Method Get
```

La ruta `/health` responde HTTP 204 cuando la API está activa; el frontend debe responder HTTP 200.

## Consultar tablas y migraciones con psql

```powershell
docker compose exec db psql -U padelmatch -d padelmatch -c "\dt"
docker compose exec db psql -U padelmatch -d padelmatch -c "SELECT version, applied_at FROM schema_migrations ORDER BY version;"
```

Los comandos usan los valores por defecto. Si cambiaste `POSTGRES_USER` o `POSTGRES_DB` en `.env`, reemplazá `padelmatch` por esos valores.

## Conectarse con DBeaver o pgAdmin

Creá una conexión PostgreSQL con estos datos:

- Host: `127.0.0.1`
- Puerto: `5433` (o el valor de `DB_PORT` en `.env`)
- Base: el valor de `POSTGRES_DB` (por defecto `padelmatch`)
- Usuario: el valor de `POSTGRES_USER` (por defecto `padelmatch`)
- Contraseña: el valor de `POSTGRES_PASSWORD` en tu `.env`

No compartas ni subas el archivo `.env`.

## Logs

```powershell
docker compose logs -f db backend frontend
docker compose logs -f backend
```

## Detener, reiniciar y conservar datos

```powershell
docker compose stop
docker compose start
```

Para detener y retirar los contenedores y la red del proyecto, manteniendo el volumen:

```powershell
docker compose down
```

**Advertencia:** `docker compose down -v` elimina los volúmenes del proyecto y puede borrar permanentemente los datos locales de PostgreSQL. No lo uses si querés conservar la base.

Cada integrante tiene una instancia y un volumen independientes en su propia computadora; los datos no se sincronizan entre el grupo.

## Resolver conflictos de puertos

Si 8081, 8000 o 5433 ya están ocupados, editá esos valores en `.env`. Por ejemplo:

```dotenv
FRONTEND_PORT=8082
API_PORT=8001
DB_PORT=5434
```

Luego recreá los servicios:

```powershell
docker compose down
docker compose up -d --build
```

También se puede comprobar qué proceso ocupa un puerto desde PowerShell:

```powershell
Get-NetTCPConnection -State Listen -LocalPort 8081,8000,5433
```

No detengas ni elimines contenedores o bases de otros proyectos para liberar puertos; asigná puertos distintos en tu `.env`.
