## Why

El MVP actual (`build-vista-valle-booking-mvp`) solo soporta pago al llegar (pay-at-property); el pago online quedó explícitamente fuera de alcance y documentado como una fase posterior (`PRODUCT.md`, confirmado 2026-08-21). El negocio ahora quiere ofrecer pago online como una segunda modalidad junto al pago al llegar, y eligió a Fintoc como primer proveedor (con Mercado Pago sumándose después como segunda opción), para dar flexibilidad de pago al huésped sin retirar la opción actual.

## What Changes

- Agregar Fintoc Checkout como una nueva modalidad de pago disponible al confirmar una reserva, seleccionable junto a "pago al llegar".
- Crear el flujo de creación de un payment intent/checkout session de Fintoc al confirmar la reserva, y persistir su referencia junto al estado de pago de la reserva.
- Agregar un endpoint de webhook que reciba las notificaciones de Fintoc (pago aprobado, rechazado, reembolsado) y actualice el estado de pago existente (pendiente/aprobado/rechazado/reembolsado) sin alterar el estado de la reserva.
- Agregar soporte para reembolsos de pagos hechos vía Fintoc, iniciados desde el panel administrativo.
- Agregar variables de entorno server-only para credenciales de Fintoc (API key, webhook secret) siguiendo el patrón ya usado por Mercado Pago en `.env.example`.
- Actualizar `PRODUCT.md` para reflejar que el pago online ya no está fuera de alcance, y que Fintoc es el primer proveedor habilitado (Mercado Pago queda para una iteración posterior).
- La integración se implementa contra la API REST de Fintoc directamente (no vía su servidor MCP operativo, que actualmente falla en `tools/list` por incompatibilidad de protocolo).

## Capabilities

### New Capabilities
- `fintoc-payment-integration`: creación de payment intents/checkout de Fintoc, manejo de su webhook de confirmación, y reembolsos vía API de Fintoc.

### Modified Capabilities
- `payment-processing`: se agrega la modalidad de pago online (además de pago al llegar) y el nuevo estado transicional "pago iniciado/en proceso" antes de aprobado/rechazado, manteniendo los estados independientes de pago ya definidos (pendiente, aprobado, rechazado, cancelado, reembolsado). Nota: esta capability todavía vive como delta en el change pendiente `build-vista-valle-booking-mvp` (no está aún en `openspec/specs/`); este change agrega un delta adicional sobre esa misma capability y debe aplicarse después de (o junto con) que ese change se archive.

## Impact

- Backend: nuevo cliente de API REST de Fintoc, endpoint de creación de checkout, endpoint de webhook, lógica de reembolso.
- Base de datos: nuevas columnas/tabla para referenciar el payment intent/checkout de Fintoc asociado a una reserva (reutilizando el modelo de estado de pago de `payment-processing`).
- Configuración: nuevas variables de entorno server-only (`FINTOC_*`), documentadas en `.env.example` y `.env.test.example`.
- Frontend: selector de modalidad de pago (pago al llegar vs. pago online) en el flujo de confirmación de reserva.
- Documentación: actualización de `PRODUCT.md` sobre alcance de pago online.
- Dependencia cruzada: requiere que el modelo de estados de pago de `payment-processing` (definido en `build-vista-valle-booking-mvp`) esté disponible.
