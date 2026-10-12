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

## HU-02 — Alta de complejos y encargados

### Frontend completado y probado

- Se agregó `/admin/complejos`, con alta, edición, baja confirmable, datos de contacto y asignación de múltiples encargados.
- La sesión del formulario de login navega a esa ruta cuando las validaciones locales pasan. Esta navegación es solo una entrada de demo: no verifica credenciales ni crea una sesión.
- `ComplexPreviewStore` administra los datos de ejemplo en memoria; al recargar se restablecen. El selector de rol simula la vista de administración/encargado y filtra los complejos asignados. No aplica seguridad real.
- Los componentes de navegación, tarjeta, formulario y diálogos son independientes para reutilización y mantenimiento.
- Stitch tiene una pantalla pública de “Clubes”, no un panel administrativo de complejos; el frontend reutiliza el sistema visual existente.
- Verificación anterior: `npm test -- --watch=false` pasó 6 pruebas; la imagen `padelmatch-frontend:latest` se reconstruyó y el contenedor quedó saludable. Las rutas `/ingresar` y `/admin/complejos` respondieron HTTP 200.
- Revisión final: `npm run build` pasó. Al repetir `npm test -- --watch=false`, Vitest falló antes de ejecutar tests al no resolver `@angular/core` desde el `init-testbed.js` generado. La llamada actual a localhost y Docker también quedó bloqueada por permisos del entorno.
- Prueba manual en navegador: login de demo → panel, alta local de un complejo y simulación del alcance de un encargado; sin errores de consola.

### Archivos principales

- `frontend/src/app/complexes/complex-admin.page.*`: coordinación del panel.
- `complex-preview.store.ts` y `complex.model.ts`: modelos y datos de demostración locales.
- `complex-form.component.*`, `complex-card.component.*`, `confirm-dialog.component.*` y `complex-admin-sidebar.component.*`: piezas reutilizables.
- `app.routes.ts` y `auth/login.page.ts`: ruta de HU-02 y continuación de demo desde el login.

### Pendiente de backend

Persistencia, endpoints, autenticación, sesión, asignación segura de encargados y autorización efectiva por complejo. El selector de rol solo sirve para probar la presentación frontend.

La HU-02 permanece en **En proceso** en Trello hasta completar backend e integración; su checklist de Frontend queda completo y el de Backend sigue pendiente.

### Commit sugerido

`HU-02: implementar administración visual de complejos y encargados`

### Ajustes visuales de login y administración

- Se quitó el texto de comunidad del login, se colocó el título junto al logo y se duplicó el tamaño del logo en escritorio; en móvil conserva una escala compacta.
- El panel ahora presenta únicamente “Complejos” en el encabezado, sin banner informativo, contador ni leyenda de alcance del encargado. El botón “Nuevo complejo” tiene menor tamaño.
- Se eliminó el rótulo “Nuevo complejo” del modal, se amplió su ancho y se compactó el formulario para que no use scroll interno. El selector de zona es personalizado, con opciones visuales propias.
- La confirmación de baja ya no muestra la explicación sobre el almacenamiento local/backend.
- Verificación: `npm run build` y la reconstrucción Docker pasaron; el contenedor `padelmatch-frontend:latest` quedó saludable. En `http://localhost:8080` se comprobó login → panel, modal y selección personalizada de zona.

### Transiciones y confirmación de guardado

- Se quitó del login el texto introductorio solicitado. Al enviar credenciales de prueba válidas, la pantalla sale con una transición lateral con perspectiva y el panel entra desde el lado opuesto; con `prefers-reduced-motion` la navegación continúa sin esperar animación.
- La apertura del formulario de complejo es más pausada. Cancelar, guardar o hacer clic fuera activa una animación de salida y mantiene el diálogo en pantalla hasta que termina.
- Se agregó `app-toast`, componente reutilizable de confirmación accesible con autocierre y botón para descartarlo. Se muestra al crear, editar o quitar un complejo en el estado local de prueba.
- La navegación de login sigue siendo exclusivamente frontend y no valida credenciales contra un servicio.
- Verificación: `npm run build` y `docker compose up --build -d frontend` completaron; el contenedor se inició con la imagen actualizada. En navegador se verificó que el login transiciona al panel, se creó un complejo temporal, el modal terminó su salida y se mostró el toast. Se recargó la página al final para descartar el dato local usado durante la prueba.
- `npm test -- --watch=false` no llegó a ejecutar casos: Vitest reportó `Timeout waiting for worker to respond` al iniciar el worker de Windows. El bundle de pruebas sí compiló. La limitación queda pendiente de resolver en el entorno de pruebas.

### Ajustes responsive y feedback de complejos

- Se redujo el tamaño del título y el logo de acceso con medidas fluidas para móvil, junto con espacios y controles más compactos; se agregó un ajuste extra para pantallas de hasta 360 px.
- El panel reduce su espacio superior, adapta la grilla de complejos al ancho disponible y ajusta barra, controles y tarjetas en móvil. El modal limita su altura al viewport, permite desplazamiento interno cuando el teléfono lo requiere y reorganiza los campos en una columna.
- La apertura del modal ahora dura 620 ms y el cierre 660 ms. El toast se monta fuera de la capa del modal y aparece después de la animación de cierre para que quede visible. El contenedor del toast respeta el ancho de pantalla y las áreas seguras del dispositivo.
- Verificación: build de Angular y rebuild de Docker correctos. En el navegador Docker a 558 × 510 px, login y panel no tuvieron desbordamiento horizontal; se verificaron el modal, la creación y actualización, y los dos mensajes de confirmación. El modal cerró tras la duración configurada y el toast se vio sobre el panel.
