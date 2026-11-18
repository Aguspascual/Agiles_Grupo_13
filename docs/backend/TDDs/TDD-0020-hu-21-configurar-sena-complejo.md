---
id: "0020"
estado: Aprobado por el usuario
version: 1
fecha: "2026-11-17"
titulo: Configurar precio del turno y seña del complejo
hu: HU-21
---

# TDD-0020: Configurar seña del complejo

## Contexto de negocio

El encargado configura un precio común a todas las canchas y duraciones de su complejo, y puede activar una seña fija o porcentual.

### Criterios de aceptación

- **CA-01:** el encargado asignado y el administrador pueden activar o desactivar la seña del complejo; otros usuarios no pueden cambiarla.
- **CA-02:** el precio se expresa en ARS, es positivo y admite hasta dos decimales. La seña fija es positiva y no supera el precio; la porcentual está entre 1% y 100%.
- **CA-03:** con la seña desactivada las reservas existentes siguen exactamente el flujo actual, sin pagos ni bloqueos.

## Diseño técnico

### Modelo y persistencia

- Migración aditiva `021_complex_deposit_settings.sql`.
- Precio almacenado como centavos enteros en `complexes.turn_price_cents`.
- `deposit_enabled`, `deposit_type` (`fixed` o `percentage`) y `deposit_value_units`; esta última guarda centavos si el tipo es fijo y centésimas de porcentaje si es porcentual.
- Una configuración omitida por clientes anteriores crea el complejo con seña desactivada. Una actualización sin `pricing` preserva la configuración existente.
- La configuración de seña no interviene en la creación ni confirmación de reservas; no hay pagos en esta historia.

### API existente

No se agregan endpoints. Se amplía `GET /api/v1/complexes` y el cuerpo existente de `POST /api/v1/complexes` y `PUT /api/v1/complexes/{id}`.

```json
{
  "pricing": {
    "turnPrice": "12500.50",
    "depositEnabled": true,
    "depositType": "fixed",
    "depositValue": "3500.25"
  }
}
```

Los importes llegan y se devuelven como cadenas decimales para conservar precisión en JavaScript. El servidor los decodifica exactamente y los persiste en unidades menores enteras. Para `percentage`, `depositValue` representa un valor de 1 a 100 inclusive (admite dos decimales). Las respuestas/listados administrativos devuelven la misma configuración. La respuesta pública de complejos no se amplía.

### Permisos y errores

- JWT requerido por el middleware existente.
- Solo el encargado asignado al complejo o un administrador puede modificar su configuración; se reutiliza la autorización del endpoint `PUT`.
- Datos fuera de rango o formato con más de dos decimales: `400` sin modificar la configuración anterior.
- Usuario sin asignación: `403`; complejo inexistente: `404`.

## Casos de borde y pruebas

Precio cero/negativo o con más de dos decimales; seña fija cero, negativa o superior al precio; porcentaje por debajo de 1 o superior a 100; modificación con configuración omitida; autorización; persistencia PostgreSQL y reserva normal con seña desactivada.

## Alcance

Sin Mercado Pago, transferencias, cobros, comprobantes, confirmación de pagos ni cambios al flujo de reservas.
