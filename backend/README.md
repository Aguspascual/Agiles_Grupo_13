# Backend HU-01

API Go para registro e inicio de sesión, con PostgreSQL como almacenamiento.

## Trabajo en equipo

- Elegir una HU en Trello, registrarse en la tarjeta y avisar por el grupo.
- Crear la rama desde `Desarrollo` actualizado: `feature/descripcion`, por ejemplo `feature/horarios-disponibles`.
- Usar commits atómicos `HU-XX: verbo en infinitivo + qué se hizo`; no subir `node_modules` ni archivos `.env`.
- Abrir PR a `Desarrollo` con título `HU-XX (back): nombre de la historia`, link a Trello, qué cambia y cómo probarlo. Requiere una aprobación de otro integrante backend.
- Con aprobación y validaciones correctas, el autor integra con **Create a merge commit**, elimina la rama cuando no queden dependientes y pega el link de la PR en Trello.

Los [acuerdos backend](../docs/backend/AGENTS_BACK.md) reúnen el detalle de este flujo y la práctica TDD. No implementar sin aprobación del TDD correspondiente.

## Configuración

Definir `DATABASE_URL`, `JWT_SECRET` (secreto de al menos 32 bytes) y, opcionalmente, `PORT` (por defecto `8000`). Al iniciar, el servidor comprueba PostgreSQL y aplica la migración incluida.

```powershell
cd backend
go run ./cmd/api
```

## API

- `POST /api/v1/auth/register`: recibe `name`, `email`, `password`, `zone`, `level`, `position`, `hand` y `fairPlay`; devuelve usuario y JWT.
- `POST /api/v1/auth/login`: recibe `email` y `password`; devuelve usuario y JWT.
- `GET /api/v1/auth/me`: requiere `Authorization: Bearer <token>` y devuelve el usuario de la sesión.
- `GET /health`: responde `204` cuando el proceso está activo.

`zone` acepta únicamente Casco Urbano, Gonnet, City Bell, San Carlos, Tolosa, Villa Elisa o Berisso / Ensenada. Se recortan espacios al inicio y final. El registro crea `users` y `player_profiles` en una misma transacción. La migración no crea tablas `zones` ni `user_zones`.
