# Registro de desarrollo — HU-01

## Alcance y fase

Entrega de frontend para la **HU-01: Registro e inicio de sesión**, correspondiente a la fase 04 del MVP (Auth y perfil). Se implementaron las pantallas y estados visuales de Stitch para ingresar y registrarse, con textos en español rioplatense.

El cambio cubre únicamente la interfaz y validación local de formularios. No agrega backend, base de datos, endpoints, almacenamiento de credenciales, inicio de sesión real ni alta persistida de cuentas. La fase 04 permanece parcial: HU-02 y la integración de autenticación/perfil no están incluidas. Las fases 01 a 03 tampoco se marcaron como completadas.

## Fases ejecutadas

1. **Estructura frontend:** aplicación Angular standalone con rutas `/ingresar` y `/registro`.
2. **Interfaz HU-01:** formularios responsivos, validaciones, navegación entre pantallas, nivel/zona/preferencias y estados informativos de vista previa.
3. **Reutilización y UX:** aviso de formulario reusable, estilos compartidos y animaciones ligeras para aparición, selección, hover y foco. Las preferencias del sistema para movimiento reducido desactivan las animaciones.
4. **Empaquetado:** imagen Docker `padelmatch-frontend:latest`, multi-stage, que compila Angular y sirve los archivos estáticos con Nginx. `docker-compose.yml` ejecuta solo el servicio frontend en `http://localhost:8080`; Nginx devuelve la app para rutas Angular.
5. **Verificación y documentación:** pruebas unitarias, build de producción y flujo visual probados; este registro detalla límites y archivos de la entrega.

## Archivos principales

- `frontend/src/app/auth/login.page.*`: ingreso y validación del formulario.
- `frontend/src/app/auth/register.page.*`: alta visual y validaciones del perfil inicial.
- `frontend/src/app/auth/preview-notice.component.ts`: aviso compartido de vista previa.
- `frontend/src/styles.scss`: tokens visuales, estilos compartidos, responsive y animaciones accesibles.
- `frontend/public/images/`: imágenes locales provenientes de la referencia Stitch.
- `frontend/Dockerfile`, `frontend/nginx.conf`, `frontend/.dockerignore`, `docker-compose.yml`: build y distribución del frontend.
- `AGENTS.md`, `frontend/README.md`, `docs/phases/`: acuerdos de contribución, ejecución y estado de fase.

## Comandos de desarrollo

Desde la carpeta `frontend/`:

```bash
npm install --legacy-peer-deps
npm start
npm test -- --watch=false
npm run build
```

Desde la raíz del repositorio, con Docker Engine iniciado:

```bash
docker compose up --build
```

La verificación local de esta entrega cubrió `npm test -- --watch=false` y `npm run build`. Docker Desktop/Engine no estaba iniciado durante esta sesión, por lo que no se pudo construir ni iniciar el contenedor en ejecución.

## Criterios frontend cubiertos

- El ingreso valida correo y contraseña y permite alternar la visibilidad de la clave.
- El registro valida datos obligatorios, formato de correo, longitud mínima, coincidencia de contraseñas, selección de zona/nivel y compromiso de juego.
- Las animaciones no bloquean controles y respetan `prefers-reduced-motion`.
- No se envían datos ni se afirma que se creó una cuenta o sesión.
- Docker empaqueta y sirve solamente activos estáticos del frontend.

## Commit sugerido

`HU-01: dockerizar y modularizar el frontend de registro e inicio de sesión`
