# Mejora: ajustes visuales de login y registro

Rama: `mejora/frontend-ajustes-visuales`. Alcance: solo frontend.

## Fases

1. **Login compacto.** Tarjeta, campos y panel derecho más chicos; tercera tarjeta informativa; "¿Olvidaste tu contraseña?" debajo del campo; botones de Google y Apple con colores de marca.
2. **Resolución 800x600 (proyector).** Login y registro en dos columnas compactas entre 681px y 1030px de ancho; una columna por debajo de 680px.
3. **Autocompletado legible.** Texto oscuro y `color-scheme: light` para que el navegador no pinte texto claro sobre el fondo del campo.
4. **Registro.** Más espacio entre secciones, tarjeta lateral sin estirarse, desplegable de nivel propio (accesible por teclado), zona habitual con selección múltiple (mínimo una), posición y mano hábil obligatorias y en grupos separados.
5. **Mensajes de error.** Errores de campo en una sola línea y letra chica; aviso claro si el correo ya existe; desplazamiento hasta el primer error.
6. **Flujo de alta.** Al registrarse se muestra un aviso (toast) y se lleva a `/ingresar` sin iniciar sesión.

## Archivos principales

- `frontend/src/styles/_auth.scss`, `frontend/src/styles/_register.scss`
- `frontend/src/app/auth/login.page.{ts,html}`, `frontend/src/app/auth/register.page.{ts,html}`
- `frontend/src/app/auth/auth-flash.store.ts` (aviso de una sola lectura entre páginas)
- Tests: `login.page.spec.ts`, `register.page.spec.ts`

## Validaciones

- `ng test` sobre `src/app/auth/**`: 35 tests en verde.
- Revisión visual en Chrome a 800x600 y con clics reales.
- Todas las animaciones respetan `prefers-reduced-motion`.

## Límites de alcance

- No se modificó backend, base de datos ni infraestructura.
- **Zona habitual múltiple:** el servicio actual guarda una sola zona por jugador. El frontend permite elegir varias, pero envía solo la primera como zona principal. Guardar todas requiere un cambio de contrato en el backend.
- El correo repetido se detecta al enviar el formulario, no mientras se escribe, porque no existe un endpoint de consulta.
