# HU-19: validacion frontend

Fecha: 2026-11-17. Worktree: `.worktrees/hu19-registrar-ausencia`.

## Implementacion

- El panel de ausencias se integra en Mis partidos > Jugados para registros `kind=match` y `status=reserved`. En HU-17, `reserved` identifica un partido no cancelado; los cancelados y las reservas comunes quedan excluidos. La vista de proximos tampoco lo renderiza.
- La consulta GET se inicia al desplegar el panel, evitando solicitudes para tarjetas no consultadas. POST requiere confirmacion, deshabilita el doble envio y reemplaza el estado local con la respuesta del servidor.
- Se exponen estado individual agregado, conteo limitado a 2, reporte propio y plazo. La respuesta no contiene la identidad de los reportantes. Tras vencer el plazo se conserva GET y se oculta la accion de reportar.
- Los permisos, el plazo y la elegibilidad provienen del servidor. Se manejan carga, reintento, HTTP 403/409 y errores recuperables.
- Se agregaron estilos responsive y estados focus-visible para controles.

## Validaciones ejecutadas

- `npm ci`: PASS; 472 paquetes instalados desde el lockfile, sin modificar `package-lock.json` ni usar `--legacy-peer-deps`.
- Pruebas focalizadas Angular del componente y servicio HTTP: 13/13 PASS. Incluyen GET, POST, actualizacion, doble envio, errores HTTP, consulta despues del vencimiento y privacidad.
- Prueba de pagina Mis partidos: la prueba nueva de renderizado condicional para jugados, cancelados y proximos PASS. En el archivo completo, 20/21 PASS; la restante es una expectativa temporal HU-17 sobre contador de turno pasado, con fixture fechado 2026-11-03 y reloj posterior.
- Suite Angular completa: 250 PASS, 61 FAIL, 311 totales. Fallas observadas en specs de otras historias por `TestBed` ya instanciado y solicitudes HTTP pendientes; tambien falla la expectativa temporal HU-17 descrita arriba. No se modificaron esos flujos ajenos.
- `npm run build`: PASS. Angular advierte sobre `RouterLink` no usado y presupuestos existentes de bundle/estilos, sin bloquear la compilacion.
- `go test ./cmd/api -run '^TestHU19' -count=1`: PASS contra PostgreSQL real.
- `gofmt -d`: sin diferencias de formato en los Go propios de HU-19. En otros archivos Go modificados por HU-19, la salida corresponde a diferencias LF/CRLF; no se reescribieron esas terminaciones.
- `git diff --check`: PASS.

## Estado

El flujo funcional HU-19 queda conectado de Angular a los endpoints reales. Las validaciones focalizadas de HU-19 y el build pasan. No se puede declarar verde la suite Angular completa hasta resolver su aislamiento entre specs y la prueba temporal antigua de HU-17. No incluye HU-16, acompanantes anonimos, reputacion, correos ni notificaciones.
