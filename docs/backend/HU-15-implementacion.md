# HU-15: implementación de alta manual

Implementa exclusivamente el alta definida en [TDD-0012](TDDs/TDD-0012-hu-15-alta-reserva-manual.md).
La conexión visual del frontend sigue pendiente; esta entrega no completa ese flujo.

## Fases y archivos principales

1. **Red:** pruebas HTTP/PostgreSQL fallaron por ruta manual inexistente (`404`) y
   ausencia de las columnas de origen/registrante en el escenario de migración histórica.
   El intento inicial sin acceso a sockets no cuenta como evidencia Red.
2. **Green:** nueva ruta en `backend/cmd/api/routes.go` y alta compartida en
   `backend/internal/reservations`. La autorización administrativa usa la misma
   transacción, bloqueo compartido del complejo, rol vigente bloqueado y bloqueo
   exclusivo de cancha. El origen determina identidad y aviso, no la lógica de ocupación.
3. **Migración:** `007_manual_reservations.sql` completa los registros web existentes
   y agrega restricciones condicionales; conserva datos, avisos, estados e índice.
   Las pruebas históricas parten del esquema real de `005`, con reservas vigentes y
   canceladas y sus avisos; luego ejecutan el migrador e inspeccionan la persistencia.
4. **Refactor y regresión:** reutilización de validación/ocupación, permisos y formatos
   HU-06; fixtures SQL existentes completan el registrante real, sin alterar sus casos.

## Validaciones

- **Pasó:** pruebas enfocadas `TestHTTPManual*`, migración histórica y pruebas de
  dominio de contacto/fecha/horario, con PostgreSQL descartable.
- **Pasó:** carreras manual/manual y manual/web, permisos e aislamiento, rechazos sin
  escrituras, fallo de inserción sin efectos parciales, revocación de asignación/rol
  mientras el alta espera un bloqueo, privacidad y regresión de consultas/avisos web.
- **Pasó:** `TestManualReservationAndChangeBothLockOrders` cubre alta frente a baja de
  cancha, baja de día y cambio incompatible de franjas, con ambos órdenes de espera.
- **Pasó:** suite completa con PostgreSQL 17.11 descartable: 234 pruebas/subpruebas,
  cero fallidas y cero omitidas. `go vet ./...` también pasó.
- **Pasó:** verificación independiente en una copia temporal aislada, repitiendo suite
  y vet con los mismos resultados. Sus pruebas adicionales verificaron democión del
  administrador mientras espera el bloqueo de usuario, rechazo de campos del servidor
  sin cambios y restricciones de identidad manual.
- **Pasó:** comparación diferencial con la base anterior para alta web, reservas propias,
  avisos, conflicto y campo `origin` rechazado. Coincidieron estados HTTP, cabeceras,
  estructura JSON y mensajes, normalizando únicamente IDs y fechas de creación generados.
- **Pasó:** repetición del agente principal de las pruebas HTTP/migración enfocadas con
  PostgreSQL 17, `gofmt` sin diferencias y `git diff --check`.

Comandos desde `backend/`, con `TEST_DATABASE_URL` apuntando únicamente a una base
PostgreSQL descartable `padelmatch_test`:

```powershell
go test -count=1 ./...
go vet ./...
```

La comprobación inicial del código base con PostgreSQL 18.1 encontró una falla
preexistente en `TestPostgresCourtsIntegration`: espera otro SQLSTATE al borrar una
fila protegida por `ON DELETE RESTRICT`, pero esa versión devuelve `23001`. No se
cambia esa prueba ajena para aparentar éxito; los resultados finales distinguirán
la versión de PostgreSQL utilizada y cualquier falla u omisión.

La suite final se verificó con la imagen PostgreSQL 17 ya disponible, en un contenedor
propio temporal con datos en memoria y puerto limitado a localhost. No se descargaron
imágenes ni se modificó la configuración Docker del proyecto. `migrations` no contiene
tests propios; sus cambios sí se ejecutaron en las pruebas de integración y actualización.

## Despliegue y límites

- Aplicar la migración junto con el backend actualizado y sin escritores antiguos:
  estos no completan `registered_by`. No reescribir migraciones ya aplicadas ni
  revertir eliminando datos manuales. El número `006` se deja a HU-14.
- Manuales: contacto persistido, registrante real, organizador y acompañantes nulos;
  sin alta de cuentas ni avisos. La ocupación pública no selecciona datos personales.
- HU-14 conserva su alcance de reservas web del organizador. Su endpoint no está
  integrado en la base de esta entrega y no se implementa ni amplía aquí.
- Sin frontend, Docker, agenda, edición, cancelación, participantes, pagos ni avisos
  externos. Sin cambios en Trello ni publicación automática.
