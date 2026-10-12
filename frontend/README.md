# PádelMatch LP — frontend HU-01

Frontend Angular para **registro e inicio de sesión**. Las vistas se basan en las pantallas de Google Stitch del proyecto PádelMatch: ingreso de escritorio, ingreso móvil y registro de jugador.

## Alcance

- `/ingresar`: formulario de acceso, validación de correo y contraseña, opción de ver la contraseña y enlace al registro.
- `/registro`: datos personales, zona, nivel inicial y preferencias de juego. Valida correo, contraseña, confirmación y campos obligatorios.
- El registro solo muestra una confirmación de vista previa. **No crea una cuenta, no inicia sesión ni envía datos**: HU-01 está implementada solo en el frontend.
- Los botones de Google y Apple se muestran deshabilitados porque aún no hay proveedores de acceso configurados.
- En modo de prueba, un ingreso válido lleva a `/admin/complejos` para recorrer HU-02 sin backend. La pantalla usa datos solo en memoria y el selector de rol simula el alcance visual; no valida credenciales ni protege recursos.

## HU-02 — Complejos y encargados

La ruta `/admin/complejos` permite probar alta, edición, baja confirmable y asignación de uno o más encargados sobre datos de ejemplo. El formulario, las tarjetas, el menú lateral y los diálogos son componentes independientes. Al recargar la página vuelven los datos iniciales.

Para entrar manualmente, completá el formulario de `/ingresar` con cualquier correo y contraseña que pasen la validación local. Esto es una navegación de demo; no representa autenticación real.

El texto promocional de Stitch sobre ranking, resultados y reservas se ajustó al alcance actual del MVP.

## Ejecutar

Requiere Node.js 22.12 o superior compatible con Angular 21.

```bash
npm install --legacy-peer-deps
npm start
```

Abrir `http://localhost:4200/ingresar` o `http://localhost:4200/registro`.

## Docker

Desde la raíz del repositorio, con Docker Engine iniciado:

```bash
docker compose up --build
```

Abrir `http://localhost:8080`. Compose levanta únicamente el frontend Angular compilado y servido por Nginx; la imagen local queda disponible como `padelmatch-frontend:latest`.

## Verificar

```bash
npm test -- --watch=false
npm run build
```

El frontend no necesita un backend para estas verificaciones.

El avance detallado de HU-01 y la fase 04 se registra en [`docs/CHANGELOG-DEVELOPMENT.md`](../docs/CHANGELOG-DEVELOPMENT.md).
