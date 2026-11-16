# HU-18 · Compartir partido por WhatsApp

## Fases realizadas

1. Se revisó el flujo público de búsqueda y detalle de partidos.
2. Se agregó una acción de WhatsApp disponible para el organizador.
3. El mensaje incluye complejo, día, horario y un enlace directo al detalle.
4. La ruta compartida abre el detalle desde la lista pública y limpia filtros activos.
5. Si un visitante necesita iniciar sesión para unirse, el regreso conserva el partido compartido.
6. Al publicar un partido abierto, se pide confirmación antes de enviarlo y luego se ofrece copiar o compartir el enlace.

## Archivos principales

- `frontend/src/app/matches/match-share.service.ts`: genera el enlace del partido y la URL de WhatsApp.
- `frontend/src/app/matches/match-published-dialog.component.*`: confirmación de publicación y opciones para compartir el enlace.
- `frontend/src/app/matches/create-match-dialog.component.*`: confirmación antes de publicar.
- `frontend/src/app/landing/match-detail-dialog.component.ts` y `.html`: muestra la acción al organizador.
- `frontend/src/app/landing/match-search.page.ts`: resuelve enlaces compartidos y conserva el destino tras autenticarse.
- `frontend/src/styles/match-detail.scss`: estilo accesible y responsive.

## Validación

- Build del frontend en el contenedor Docker del proyecto.
- Revisar que el organizador vea el botón y WhatsApp abra con mensaje y enlace.
- Abrir `/partidos?partido=<id>` para comprobar el detalle y el retorno después del login.

## Alcance y pendiente

- Cambio exclusivamente frontend; no agrega endpoints ni modifica el backend.
- El detalle se resuelve desde la lista pública actual. Si el partido ya no aparece en esa lista, se informa que no está disponible.
