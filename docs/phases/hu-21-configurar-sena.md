# HU-21 — Configurar precio y seña del complejo

## Fases realizadas

- **RED:** se verificó el rechazo del campo `pricing` por el contrato anterior del backend y la ausencia de los campos de precio y seña en el formulario Angular.
- **GREEN:** se agregó persistencia PostgreSQL, validación exacta en centavos/unidades de porcentaje, extensión de los contratos existentes de complejos y controles en el formulario de administración.
- **REFACTOR/validación:** se cubrieron permisos, límites, persistencia, actualización de configuración y reserva sin pago con pruebas HTTP sobre PostgreSQL real; se ampliaron pruebas del formulario.
- **Compatibilidad:** se permitió editar complejos existentes con precio legado `0.00` y se omite `pricing` en el PUT si sigue sin configurarse y con seña desactivada. Se aplicaron en un esquema descartable las migraciones de Desarrollo, HU-19 020 y HU-21 021 en ese orden.

## Archivos principales

- `backend/migrations/021_complex_deposit_settings.sql`
- `backend/internal/complexes/{model.go,postgres.go,decimal_amount.go}`
- `backend/cmd/api/hu21_deposit_settings_http_test.go`
- `frontend/src/app/complexes/complex-{model.ts,api.service.ts,form.component.ts,form.component.html,form.component.scss}`
- `docs/backend/TDDs/TDD-0020-hu-21-configurar-sena-complejo.md`

## Validaciones

- Backend: `go test ./internal/complexes ./cmd/api -run 'Test(HU21|DecimalAmount|PricingValidation)' -count=1 -timeout=180s` aprobado; integración HTTP ejecutada contra el contenedor PostgreSQL de pruebas.
- PostgreSQL: la migración completa se aplica desde los fixtures HTTP. Se verificaron guardado/lectura, autorización, valores fuera de rango, conservación de la configuración ante errores, compatibilidad de actualizaciones antiguas y reserva normal con seña desactivada.
- Angular: suite focalizada de complejos (componentes y HTTP), 27 pruebas aprobadas.
- `go vet ./...`, `git diff --check` y `gofmt -d` en archivos Go HU-21: aprobados.
- `npm run build`: aprobado. Angular emitió advertencias de presupuesto de bundle/SCSS ya aplicables al proyecto; también advirtió que el SCSS del formulario excede su presupuesto de 4 kB (el archivo ya superaba ese umbral en `origin/Desarrollo`).
- Compatibilidad HU-19/HU-21: `HU19_HU21_MIGRATIONS_OK` en PostgreSQL descartable; el esquema temporal se eliminó al terminar.

## Alcance y límites

- Precio único por complejo en ARS; importes con hasta dos decimales.
- Seña fija o porcentual opcional, sin pagos, transferencias, comprobantes ni cambios al ciclo de reservas.
- Migración aditiva 021; la configuración omitida por clientes anteriores conserva compatibilidad.
