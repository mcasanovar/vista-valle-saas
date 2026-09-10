## 1. Datos y dominio de precio por ocupación

- [x] 1.1 Agregar la tabla Drizzle `room_occupancy_prices` (`room_id`, `occupancy`, `price_clp`, `unique(room_id, occupancy)`, checks `occupancy > 0` y `price_clp > 0`) en `src/persistence/schema.ts` y generar la migración; verificar con `npx drizzle-kit generate` sin errores y revisando el SQL generado.
- [x] 1.2 Agregar `guest_count integer not null` a `reservation_items` en la misma migración, con backfill para filas existentes (ver design.md - Open Questions para el valor de relleno); verificar que la migración corre limpia contra una base con datos de prueba (`npm run test:postgres` o el script equivalente de integración).
- [x] 1.3 Implementar `resolveRoomNightlyPrice(room, occupancyPrices, guestCount)` en `src/features/rooms` (respaldo a `baseNightlyPriceClp` sin filas configuradas, rechazo si `guestCount` está fuera de `1..capacity`); verificar con tests unitarios que cubran: tarifas diferenciadas, precio fijo (ambas filas iguales), sin filas configuradas, y ocupación fuera de rango.
- [x] 1.4 Extender `RoomReadModel` y `queryProductionRooms` (`src/infrastructure/database/room-source.ts`) para incluir las tarifas por ocupación de cada habitación (join a `room_occupancy_prices`); verificar con un test de infraestructura que una habitación con y sin filas configuradas devuelve el shape esperado.

## 2. Búsqueda pública sin filtro de capacidad total

- [x] 2.1 Quitar el filtro `room.capacity >= guests` en `searchAvailability` (`src/features/availability/search.ts`), dejando solo el filtro de disponibilidad por fechas; verificar con tests existentes de `availability-search.test.ts` actualizados más un caso nuevo: búsqueda de 2 huéspedes devuelve las 3 habitaciones de capacidad 2 aunque ninguna sea "capacidad >= huéspedes totales" trivialmente distinta.
- [x] 2.2 Actualizar el mensaje de "sin disponibilidad" y el manejo de habitación preseleccionada (`AvailabilityResultsRegion`/`AvailabilityResultsTemplate`) para que ya no dependan de la capacidad total del grupo; verificar con `tests/availability-results.test.ts` (o el archivo equivalente) que una habitación preseleccionada de capacidad menor al total buscado sigue apareciendo como disponible.

## 3. Selector de ocupación y reparto en la interfaz pública

- [x] 3.1 Implementar un helper puro compartido de "reparto de huéspedes" (huéspedes ya asignados entre habitaciones seleccionadas, cupo restante, qué ocupaciones/habitaciones bloquear) reutilizable por resultados, detalle y carro; verificar con tests unitarios los casos de la spec `availability-search-experience` (reparto completo, reparto entre dos habitaciones, mensaje de reparto pendiente).
- [x] 3.2 Agregar el selector de ocupación (1/2 personas) a `RoomCard` (`src/presentation/organisms/room-card.tsx`) cuando `capacity > 1`, actualizando el precio mostrado y deshabilitando opciones que superarían el cupo restante del grupo buscado; verificar interactuando en `npm run dev` y con `tests/public-organisms.test.tsx` (o equivalente) ampliado.
- [x] 3.3 Agregar el mismo selector a la tarjeta de precio del detalle de habitación (`src/presentation/templates/room-detail.tsx`), con el precio "Desde" antes de elegir ocupación; verificar con `tests/room-detail.test.tsx`.
- [x] 3.4 Mostrar el mensaje claro y conciso de huéspedes asignados vs. buscados ("Huéspedes asignados: X de Y") en resultados y en el carro; verificar visualmente en `npm run dev` navegando `/disponibilidad` con `guests=2` y agregando habitaciones, y con un test de componente para el mensaje.

## 4. Carro y pre-reserva con ocupación por habitación

- [x] 4.1 Cambiar `SessionRoomSelection` en `src/features/reservations/selection-session.ts` de `rooms: string[]` a `rooms: {roomId, guestCount}[]`, agregar `guests` (total buscado) al estado persistido, y subir la clave de `sessionStorage` a `.v2`; verificar con `tests/selection-session.test.ts` actualizado, incluyendo que una entrada `.v1` previa no se interpreta como válida.
- [x] 4.2 Actualizar `RoomCard`/`effectiveRoomSelection` y el resumen del carro (`room-selection-summary.tsx`) para leer y escribir `guestCount` por habitación, mostrando esa cantidad junto a nombre, noches y valor por noche en el detalle desplegable del carro; verificar con `tests/room-selection-summary.test.tsx`.
- [x] 4.3 Mostrar la cantidad de personas por habitación en `/pre-reserva` (`prebooking-review-controller.tsx`/`prebooking-review.ts`) y recalcular subtotales si la ocupación cambia antes de confirmar; verificar con `tests/prebooking-review.test.ts` y `tests/prebooking-cart-experience.test.tsx`.

## 5. Precio autoritativo en la cotización de reserva

- [x] 5.1 Extender los puntos de entrada de cotización (`create-hold.ts`, `create-pay-at-property-reservation.ts`, y cualquier composición multi-habitación) para resolver `nightlyPriceClp` de cada ítem vía `resolveRoomNightlyPrice` usando el `guestCount` de esa habitación específica, antes de llamar a `computeReservationPricing`/`computeMultiRoomReservationPricing`; verificar con `tests/reservation-pricing.test.ts` y `tests/reservation-quote.test.ts` cubriendo una reserva con habitaciones en distinta ocupación.
- [x] 5.2 Persistir `guest_count` en cada `reservation_items` al confirmar una reserva; verificar con `tests/manual-reservation-data.test.ts` o el test de repositorio de reservas correspondiente que el valor guardado coincide con la ocupación cotizada.

## 6. Panel de administración de tarifas

- [x] 6.1 Crear la API `GET`/`PUT /api/admin/habitaciones/[id]/tarifas` (server-side, valida enteros positivos en CLP, escribe ambas filas de `room_occupancy_prices` al guardar, omite las filas para una habitación de capacidad 1) siguiendo el patrón de `app/api/admin/breakfast-catalog`; verificar con un test de ruta (`tests/admin-dashboard-route.test.ts` o uno nuevo) que cubra guardado válido y rechazo de valores inválidos.
- [x] 6.2 Crear la vista `/admin/habitaciones/[id]/tarifas` con el editor de precio para 1/2 personas y la casilla "mismo precio", análoga a `breakfast-catalog-settings.tsx`, mostrando un único campo para habitaciones de capacidad 1; verificar en `npm run dev` editando la Habitación Doble y confirmando que el checkbox sincroniza el segundo precio.
- [x] 6.3 Enlazar "Editar tarifas" desde `/admin/habitaciones` (junto al enlace existente "Gestionar fotos") y mostrar el estado de configuración de cada habitación (dos tarifas / precio fijo); verificar visualmente y con un test de la página `admin/habitaciones`.
- [x] 6.4 Registrar auditoría (actor, fecha, valores guardados) de cada cambio de tarifa, reutilizando el mecanismo ya usado por la gestión de fotos; verificar con un test que confirme el registro tras un guardado.

## 7. Verificación end-to-end

- [x] 7.1 Actualizar o agregar un test e2e (`e2e/public-booking.spec.ts` o uno nuevo) que busque 2 huéspedes, reparta 1 persona en la Doble y 1 en la Matrimonial, y confirme que el total de la pre-reserva usa el precio de 1 persona en ambas; verificar que el test pasa con `npx playwright test`.
- [x] 7.2 Agregar un test e2e de admin (`e2e/admin-room-blocks.spec.ts` o uno nuevo) que edite las tarifas de la Habitación Doble y confirme que el nuevo precio aparece en una búsqueda pública posterior; verificar que el test pasa.
