## Why

Hoy los dos métodos de pago ("pagar al llegar" y "pagar online" vía Fintoc) están siempre visibles y no hay forma de apagar uno sin un deploy de código. Si a futuro un proveedor de pago falla o hay que suspenderlo temporalmente, el equipo necesita poder ocultarlo desde el dashboard admin sin intervención de desarrollo.

## What Changes

- Nueva tabla singleton en la base de datos con dos flags: `payAtPropertyEnabled` y `payOnlineEnabled`, editable por un administrador autenticado.
- Nueva sección en `/admin/configuracion` (junto al catálogo de desayuno existente) con un switch por cada método de pago.
- El flujo de confirmación de reserva (`BookingConfirmationController`) oculta el método de pago que esté deshabilitado. Si ambos están deshabilitados, no se muestra ninguna opción de pago y la reserva simplemente no puede confirmarse desde ahí — sin mensaje especial de bloqueo (distinto del `BOOKING_ENABLED` global existente).
- Los endpoints `app/api/bookings/pay-at-property/route.ts` y `app/api/bookings/fintoc-checkout/route.ts` validan también en el servidor que el método solicitado esté habilitado, y rechazan la solicitud si no lo está (defensa en profundidad, no solo ocultar en la UI).
- La regla existente de que "pagar online" solo aplica cuando `roomCount === 1` se mantiene sin cambios; el nuevo flag es una condición adicional, no un reemplazo.

## Capabilities

### New Capabilities
- `admin-payment-method-settings`: gestión desde el dashboard admin de la visibilidad de cada método de pago (lectura pública del estado vigente, edición autenticada, valores por defecto).

### Modified Capabilities
- `payment-processing`: el requisito "Selección de modalidad de pago al confirmar reserva" pasa a depender también de qué métodos estén habilitados por el admin, tanto en la UI de selección como en la validación del servidor al confirmar.

## Impact

- **DB**: nueva tabla singleton (patrón igual a `companyQuotationBreakfastCatalog`) en `src/persistence/schema.ts`.
- **Backend**: nuevo repositorio server-side, nuevo endpoint `app/api/admin/payment-methods/route.ts` (GET/PUT) protegido con `requireAdministrator()`; cambios en `app/api/bookings/pay-at-property/route.ts` y `app/api/bookings/fintoc-checkout/route.ts` para validar el flag correspondiente.
- **Frontend público**: `src/features/reservations/booking-confirmation-controller.tsx` recibe los flags y oculta el método deshabilitado.
- **Frontend admin**: nuevo componente `payment-methods-settings.tsx` en `src/features/admin/`, agregado a `app/(admin-protected)/admin/configuracion/page.tsx`.
- No afecta el webhook de Fintoc ni los pagos ya iniciados/registrados.
