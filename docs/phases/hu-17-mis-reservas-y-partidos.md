# HU-17 (frontend): mis reservas y partidos

> "Como jugador, quiero ver mis reservas y partidos próximos y pasados para tener todo en un solo lugar."
> Contrato: [TDD-0013 v2](../backend/TDDs/TDD-0013-hu-17-consulta-reservas-propias.md) (`GET /api/v1/me/reservations`).

## Fases

1. **Servicio**: `ReservationApiService.listMine(view, limit, offset)` con parseo defensivo (`kind`, `status`, `role` y `match` solo para `kind=match`) y tipos exportados. `cancelOwn` (HU-14) se mantiene.
2. **Pantalla** `reservations/my-reservations.page.*` en `/mis-reservas` (carga diferida + `authGuard`, `?vista=proximos|jugados`): pestañas accesibles (`role="tablist"`, flechas), tarjetas con tipo, complejo y cancha, fecha y hora en `es-AR` según la zona que informa el servidor, estado, rol y nivel, "Ver más", estados de carga, error con "Reintentar" y vacío con enlaces a `/partidos` y `/clubes`.
3. **Cancelación** de reservas web propias (cierra el pendiente de pantalla de HU-14): botón solo si `cancellable`, confirmación "Si cancelás, el turno vuelve a quedar libre.", `saving` bloquea el doble envío, toast "Reserva cancelada." y recarga. 409 y 404 muestran su mensaje y recargan; error de conexión y genérico no recargan.
4. **Header**: los dos enlaces "Mis partidos → `/ingresar`" pasan a "Mis reservas → `/mis-reservas`" con `routerLinkActive`. Cambio mínimo en la zona de HU-00.

## Archivos principales

- `frontend/src/app/reservations/reservation-api.service.ts` y su spec.
- `frontend/src/app/reservations/my-reservations.page.{ts,html,scss}` y su spec.
- `frontend/src/app/app.routes.ts` (ruta `mis-reservas`).
- `frontend/src/app/landing/landing-header.component.ts` y su spec.

## Validación

- Pruebas con `HttpTestingController`: URL y parámetros exactos de `listMine`, parseo de reserva y partido, rechazo de formas inválidas, `cancelOwn` sin body; render de tipos y estados, botón solo con `cancellable`, flujo de cancelación, errores 409/404/0/500, vacío por pestaña, "Ver más", cambio de pestaña y respuestas obsoletas; enlaces del header.
- Se ejecutan con Node 22 (`npx -p node@22 node node_modules/@angular/cli/bin/ng.js test --runner-config=vitest.config.ts --watch=false`). Con Node 25 la suite completa falla por `localStorage` del propio Node.
- Fallas previas en `Desarrollo`, ajenas a esta HU: `app.spec.ts` (2) y `landing/landing.page.spec.ts` (8); contaminan otros archivos si se corre todo junto, por eso se verificó archivo por archivo.
- `npm run build` correcto (solo advertencias de presupuesto previas).
- Respeta `prefers-reduced-motion` (las transiciones de pestañas se desactivan).

## Límites de alcance

- No se cancelan partidos abiertos desde esta pantalla ni se avisa a los anotados (HU-14).
- "Bajarse" de un partido es HU-13; reservar sobre un partido pendiente es HU-12.
- "Jugados" significa que el horario terminó, no que el jugador asistió; el estado mostrado es el persistido.
- Sin avisos externos ni cambios de backend, Docker o `matches/`.