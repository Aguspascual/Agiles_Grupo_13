# HU-07, HU-14 y HU-15 (frontend): agenda del complejo

Estado: implementado, a la espera de revisión. Backend: [TDD-0015](../backend/TDDs/TDD-0015-hu-07-consulta-agenda-complejo.md),
[TDD-0016](../backend/TDDs/TDD-0016-hu-07-cancelacion-por-encargado.md), [TDD-0010](../backend/TDDs/TDD-0010-hu-14-cancelacion-reserva.md)
y [TDD-0012](../backend/TDDs/TDD-0012-hu-15-alta-reserva-manual.md).

## Fases

1. **Servicio HTTP** (`agenda/agenda-api.service.ts`): `load` (agenda con parseo defensivo), `registerManual` (HU-15) y
   `cancel` (HU-07). Sin estado propio.
2. **Pantalla** (`agenda/agenda.page.*`, ruta `admin/complejos/:complexId/agenda?fecha=`): sidebar de administración,
   `DayStripComponent` (hoy…+13) y `SlotGridComponent` con `cellTemplate`: libre ("Libre"), reservado (nombre, teléfono y chip
   "Web"/"Manual"), bloqueado ("No disponible") y pasado atenuado. Panel del turno elegido: **Registrar reserva** en turnos libres
   futuros y **Cancelar reserva** en reservas con `cancellable`. Lista "Reservas fuera de la grilla actual" con las reservas que
   ningún turno representa. Tras cada acción: aviso (toast) y recarga.
3. **Diálogo manual** (`agenda/manual-reservation-dialog.component.*`): formulario reactivo con nombre y teléfono obligatorios
   (se recortan, sin formato telefónico inventado). Mismo patrón de foco, Escape y animación que el diálogo de canchas.
4. **Cancelación del jugador** (`reservations/reservation-api.service.ts`): `cancelOwn`, sin pantalla. La consumirá "Mis reservas" (HU-17).
5. **Navegación**: ruta nueva, link "Agenda" en el sidebar y "Ver agenda" en la tarjeta de complejo. Se retiraron del sidebar los
   remanentes de demo de HU-02 (simulador de rol, nota "Panel de demo") y "Cerrar sesión" ahora cierra la sesión y va a `/ingresar`.

## Errores que traduce la pantalla

| Acción | Resultado |
| --- | --- |
| Cargar | 403 "No tenés permisos sobre este complejo.", 404 "No encontramos este complejo", 0/5xx error con Reintentar |
| Registrar | 409 "Ese turno ya no está disponible." + recarga, 404 + recarga, 403, 400 "Revisá los datos.", 0 conexión |
| Cancelar | 409 "La reserva ya finalizó." + recarga, 404 + recarga, 403, 0 conexión |

El doble envío se bloquea con `saving`. Las transiciones nuevas respetan `prefers-reduced-motion`.

## Archivos principales

`agenda/agenda-api.service.ts`, `agenda/agenda.page.{ts,html,scss}`, `agenda/manual-reservation-dialog.component.{ts,html,scss}`,
`reservations/reservation-api.service.ts`, `app.routes.ts`, `complexes/complex-admin-sidebar.component.*`,
`complexes/complex-card.component.html`.

Cambios mínimos en componentes compartidos: `SlotGridComponent` recibe `selectable` (por defecto, el criterio de HU-05) para que la
agenda pueda elegir turnos reservados, y `ConfirmDialogComponent` recibe `cancelLabel` (por defecto "Cancelar").

## Validación

- Pruebas Vitest: servicios (URLs, parámetros y bodies exactos), página (nombre/teléfono, acciones según `cancellable` e `isPast`,
  errores 403/404/409/0/400, doble envío), diálogo, sidebar y tarjeta.
- `npm run build` correcto (la advertencia de presupuesto de `complex-form.component.scss` ya existía).
- Verificación de punta a punta contra el backend de las fases 1 y 2 (PostgreSQL descartable): ver el cuerpo de la PR.

## Límites de alcance

- Partidos pendientes y anotados/faltantes: dependen de HU-09/10/11; el campo queda reservado, sin datos.
- Sin pantalla de jugador para cancelar hasta HU-17.
- Avisos solo internos (sin email ni WhatsApp). Agenda de hoy a hoy+13.
- Sin edición ni reprogramación de reservas, bloqueos puntuales ni cancelación de reservas ya terminadas.

## Nota sobre las pruebas en este entorno

Con Node 25 la suite completa falla en la primera prueba de `app.spec.ts` (ya fallaba antes de estos cambios) y esa falla se propaga a
otros archivos. Con Node 22 (`npx -p node@22 node node_modules/@angular/cli/bin/ng.js test --runner-config=vitest.config.ts --watch=false`)
las áreas tocadas pasan completas.

## Integración en Desarrollo (2026-10-30)

- Se recuperan los cambios de las PR #39 y #41, que se habían integrado en ramas intermedias; la PR #38 ya estaba en Desarrollo.
- Se corrige únicamente la preparación de `TestManualReservationMigrationPreservesWebData`: elimina las tablas dependientes de partidos en la base descartable y restaura el historial de migraciones 006–008 antes de probar la actualización desde 005. No cambia SQL de producción.
- Se completan tres entradas opcionales faltantes en `frontend/package-lock.json`, sin cambiar `package.json` ni las versiones ya fijadas.
- Validaciones observadas: instalación limpia con Node 22/npm 10; suite backend sobre PostgreSQL 17 descartable (308 pruebas/subpruebas correctas) y `go vet` correctos. Compilación frontend correcta (cuatro advertencias de presupuesto). Suite frontend final: 183 pruebas correctas en 33 archivos. Se actualizaron las expectativas de `returnUrl`, la petición de permisos a `/available-managers` y las pruebas de búsqueda/inscripción para usar respuestas HTTP simuladas explícitas; se conservaron las comprobaciones de baja en su componente real. Verificación independiente: sin fallas nuevas ni pruebas debilitadas.
- No se amplía el alcance funcional: se conservan los límites de partidos pendientes, avisos internos y pantalla de cancelación del jugador indicados arriba.
- Antes de publicar se incorporó el avance concurrente de Desarrollo (PR #42, HU-11) sin conflictos y se repitieron la suite frontend completa y el build, ambos correctos.

## Corrección: reservas de partido abierto en la agenda (2026-10-30)

- El backend de la agenda devuelve también las reservas `origin='open_match'` (teléfono vacío). El parser solo aceptaba `web` y `manual`, por lo que la pantalla completa caía al estado de error cuando existía un partido abierto ese día.
- `ReservationOrigin` incorpora `open_match`; el parser lo acepta (teléfono vacío permitido) y sigue rechazando orígenes desconocidos.
- La agenda muestra el chip "Partido abierto", el teléfono vacío como "—" y, al cancelar, "El partido abierto se cancelará." sin prometer avisos.
- Sin cambios de backend. Siguen fuera de alcance los anotados y faltantes en la agenda y la cancelación de partidos con aviso a los anotados.