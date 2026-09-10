## Why

Hoy cada habitación tiene un único precio por noche (`rooms.base_nightly_price_clp`), sin importar cuántos huéspedes se alojen en ella. Vista Valle necesita cobrar distinto según ocupación (1 o 2 personas) — inicialmente solo para la Habitación Doble — y dejar la búsqueda pública lista para que, cuando un grupo no quepa entero en una sola habitación, el visitante pueda repartir sus huéspedes entre varias habitaciones disponibles.

## What Changes

- Nueva forma de tarificar una habitación: precio para 1 persona y precio para 2 personas, con la opción de marcar "mismo precio para 1 o 2 personas" cuando no se quiere diferenciar (comportamiento por defecto de las habitaciones que aún no tengan tarifas configuradas).
- El admin puede editar, habitación por habitación, sus tarifas por ocupación (o dejarlas en precio fijo) desde el panel de administración.
- En disponibilidad y en el detalle de una habitación, el visitante elige cuántas personas (1 o 2) aloja en esa habitación específica, y el precio mostrado corresponde a esa elección.
- La búsqueda pública deja de exigir que una sola habitación tenga capacidad para todo el grupo buscado: ahora se listan todas las habitaciones disponibles, y el visitante arma su reserva sumando huéspedes por habitación hasta completar el total buscado. El sistema bloquea agregar más huéspedes de los buscados (deshabilita opciones u habitaciones que harían superar el total).
- La ocupación elegida por habitación (1 o 2 huéspedes) SHALL NOT afectar el bloqueo de disponibilidad de esa habitación: reservar 1 persona en una habitación de capacidad 2 la deja igual de ocupada/bloqueada que si se reservan 2 — el mecanismo actual de disponibilidad no cambia.
- El carro de reserva y la pre-reserva pasan a guardar y mostrar cuántas personas van en cada habitación seleccionada, y sus subtotales reflejan el precio de esa ocupación.

## Capabilities

### New Capabilities
- `room-occupancy-pricing`: reglas de dominio para resolver el precio por noche de una habitación según la cantidad de personas (1 o 2) que se alojan en ella, con fallback a un precio único cuando la habitación no tiene tarifas diferenciadas.
- `admin-room-pricing`: pantalla de administración para ver y editar, por habitación, sus tarifas por ocupación o su precio fijo.

### Modified Capabilities
- `availability-search-experience`: el filtro de resultados deja de exigir `capacity >= huéspedes totales de la búsqueda`; cada resultado con capacidad mayor a 1 ofrece el selector de ocupación (1/2 personas) y ajusta su precio mostrado; el sistema impide seleccionar una ocupación u agregar una habitación que superaría el total de huéspedes buscado.
- `prebooking-cart-experience`: el carro y `/pre-reserva` guardan y muestran la cantidad de personas por habitación seleccionada (no solo el identificador de habitación), calculan el subtotal de cada línea con el precio de esa ocupación, y muestran cuántos de los huéspedes buscados ya están asignados.
- `room-detail-page`: la tarjeta de precio incorpora el selector de ocupación cuando la habitación admite más de un huésped, y el precio mostrado corresponde a la ocupación seleccionada (con "Desde" el precio más bajo disponible cuando aún no se ha elegido).

## Impact

- **Datos**: nuevas columnas/tabla para tarifas por ocupación de `rooms` (precio 1 persona, precio 2 personas, indicador de "mismo precio"). Migración solo carga datos para la Habitación Doble; las demás quedan con el comportamiento de fallback (precio único) hasta que se configuren.
- **Dominio**: nueva función de resolución de precio por ocupación, consumida por composición de resultados de disponibilidad, detalle de habitación, carro/pre-reserva y los flujos de cotización de reserva (`quote.ts`) — estos últimos no cambian su contrato, solo reciben el precio ya resuelto para la ocupación elegida en cada ítem.
- **Sesión de reserva**: `selection-session.ts` (carro en `sessionStorage`) cambia su forma almacenada de una lista de IDs de habitación a una lista de `{ roomId, guestCount }`.
- **Admin**: nueva vista de tarifas por habitación (server actions/API en el patrón de `breakfast-catalog-settings.tsx`), enlazada desde `/admin/habitaciones`.
- **No incluido en este cambio**: el formulario de reserva manual del admin (`manual-reservation-form.tsx`) sigue usando una cantidad de huéspedes única por reserva; extenderlo a ocupación por habitación queda fuera de alcance.
