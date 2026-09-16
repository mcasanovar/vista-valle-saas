## Why

El módulo de creación de reservas manuales del dashboard admin no aplica el precio por ocupación (tarifas diferenciadas según cantidad de huéspedes): usa el precio base de la habitación tanto para el preview en pantalla como para el cálculo que finalmente se persiste, mientras que la reserva pública (pay-at-property) sí resuelve el precio correcto según la cantidad de personas por habitación. Esto genera reservas administrativas con montos incorrectos frente a lo que el mismo huésped pagaría por la web.

## What Changes

- El listado/disponibilidad de habitaciones que consume el formulario admin de reserva manual pasa a incluir las tarifas por ocupación (`occupancyPrices`) de cada habitación, en lugar de solo el precio base.
- El formulario admin asocia la cantidad de huéspedes seleccionada a cada habitación elegida (no solo un valor global desconectado del precio).
- El cálculo server-side que crea la reserva manual (`createManualReservationWith`) resuelve el precio por noche de cada habitación usando la misma lógica de resolución por ocupación que usa el flujo público (reutilizando `resolveRoomNightlyPrice` / `buildReservationQuote`), en vez de usar el precio base sin resolver.
- El preview de precio en pantalla del formulario admin (`pricingSummary`) muestra el mismo total que terminará cobrándose, calculado con el precio resuelto por ocupación.
- No se introduce una lógica de precios nueva ni paralela: se conecta el módulo admin a la lógica de precios por ocupación ya existente y usada por la web pública.

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `admin-manual-reservations`: la creación de reservas manuales y su preview de precio deben derivar el precio por habitación del precio resuelto por ocupación (cantidad de huéspedes), no del precio base sin resolver.
- `room-occupancy-pricing`: el requisito de "precio autoritativo para cotización de reserva" se extiende explícitamente al flujo de creación manual de reservas en el dashboard admin, para dejar claro que ese flujo no está exento de la resolución por ocupación.

## Impact

- `src/features/admin/manual-reservation-availability.ts`: incluir `occupancyPrices` en `ManualReservationAvailability` y en los datos devueltos por `resolveManualReservationAvailability`.
- `src/features/admin/manual-reservation-form.tsx`: tipo `AvailableRoom` con `occupancyPrices`; asociar `guestCount` por habitación seleccionada; `pricingSummary()` usando precio resuelto por ocupación.
- `src/features/admin/manual-reservation.ts`: `createManualReservationWith` resolviendo el precio por habitación (vía `resolveRoomNightlyPrice`/`buildReservationQuote`) y asignando `guestCount` por habitación antes de llamar a `createMultiRoomPayAtPropertyReservation`.
- Sin cambios en `src/features/rooms/occupancy-pricing.ts`, `src/features/reservations/pricing.ts`, ni en el flujo público — se reutilizan tal cual.
