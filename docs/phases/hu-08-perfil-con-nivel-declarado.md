# HU-08 · Perfil con nivel declarado

## Fases realizadas

1. Se revisó la tarjeta HU-08 de Trello y la pantalla **Editar Perfil** de Stitch.
2. Se creó `feature/front-hu08-editar-perfil` desde `Desarrollo` actualizado.
3. Se implementó el menú del jugador, la confirmación de cierre de sesión y la pantalla responsive para editar el perfil.
4. Se verificó la compilación del frontend y se reconstruyeron los contenedores Docker disponibles.

## Archivos principales

- `frontend/src/app/profile/player-profile.store.ts`: datos de demostración y persistencia local del perfil.
- `frontend/src/app/profile/player-profile.page.*`: formulario responsive de identidad, zonas, categoría, posición, estilo y privacidad.
- `frontend/src/app/landing/landing-header.component.*`: menú de usuario y diálogo de confirmación.
- `frontend/src/app/landing/match-card.component.ts`: usa la categoría guardada cuando la persona listada coincide con el apodo del perfil.
- `frontend/src/app/app.routes.ts`: ruta `/perfil`.

## Validación

- Compilación de producción Angular.
- Comprobación HTTP de `/perfil` desde el contenedor frontend (respuesta 200).
- Reinicio de los contenedores definidos por el Compose del proyecto.

## Límites de alcance

- Perfil y preferencias usan datos locales del navegador; no se agregaron endpoints ni cambios de backend.
- El cierre de sesión de demostración navega a `/ingresar`; no existe invalidación de sesión de servidor en esta HU.
- La foto se muestra como vista previa durante la sesión de la página y no se sube ni se persiste.
- Las tarjetas de partidos actuales usan fixtures; el nivel del perfil reemplaza el nivel de demostración cuando el jugador listado coincide con el apodo guardado.
