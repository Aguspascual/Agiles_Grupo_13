# HU-17: Mis partidos y reservas (integración frontend-backend)

## Fases realizadas

1. Se leyó la tarjeta de Trello HU-17 y se tomó como referencia visual Stitch “Mis Partidos - PádelMatch La Plata”.
2. Se creó `hu-17-mis-reservas-y-partidos` desde `Desarrollo` actualizado. La rama previa se renombró a `hu-17-respaldo-ui-anterior`; sus cambios locales quedaron preservados allí.
3. Se confirmó que `Desarrollo` ya incluye la implementación backend de HU-17: `GET /api/v1/me/reservations`, autenticación, filtros de próximos/jugados, paginación, clasificación de reservas/partidos y cancelabilidad. No se duplicaron endpoints ni entidades.
4. Se adaptó la pantalla Angular para consumir los datos reales, mantener Próximos/Jugados y mostrar estados, rol, nivel, cupos, próximo turno, cancelación confirmable y vacíos/errores.
5. Se dividieron las tarjetas y el resumen en componentes pequeños, se ajustó el nombre visible a “Mis partidos” y se adaptó la composición a escritorio y móvil.
6. Se compiló el frontend y se reconstruyeron/reiniciaron los contenedores para habilitar la prueba manual.

## Archivos principales de esta rama

- `frontend/src/app/reservations/my-reservations.page.{ts,html,scss}`: consulta, navegación por pestañas, estados de carga/error/vacío y layout.
- `frontend/src/app/reservations/my-reservation-card.component.{ts,html,scss}`: presentación reutilizable de reserva o partido propio.
- `frontend/src/app/reservations/my-reservations-summary.component.{ts,html,scss}`: próximo turno y resumen de los elementos cargados.
- `frontend/src/app/landing/landing-header.component.ts` y `frontend/src/app/app.routes.ts`: navegación y título de página.
- `frontend/src/app/landing/landing-header.component.spec.ts`: expectativa del rótulo “Mis partidos”.
- Backend del contrato consultado: `backend/internal/reservations/own_list.go` y `backend/internal/reservations/service.go` (ya presentes en `Desarrollo`, sin cambios en esta rama).

## Validaciones

- `frontend`: `npm run build -- --verbose` — correcto. Siguen advertencias de presupuesto preexistentes en el bundle inicial y estilos de otras pantallas; los estilos de HU-17 quedaron bajo el límite configurado.
- `docker compose -p agiles_grupo_13 up -d --build --force-recreate` — reconstruyó frontend/backend y recreó frontend, backend y PostgreSQL. Se reutilizó el volumen de datos existente.
- Las pruebas automatizadas no se ejecutaron en esta etapa.

## Límites y dependencias

- La información se obtiene del JWT y del endpoint de reservas propias; no se agregan registros mock ni nombres/contactos de otros jugadores.
- Próximos y Jugados corresponden al fin del intervalo según el servidor; no representan asistencia efectiva.
- El resumen indica únicamente los elementos cargados en la página actual.
- La rama parte de `Desarrollo`, donde el backend de la HU ya está implementado. No fue necesario alterar backend para esta integración.
