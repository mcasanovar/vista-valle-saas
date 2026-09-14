## Context

See `proposal.md` - Why/What Changes for motivation. Grounding details this design relies on:

- Las 3 habitaciones reales (`scripts/room-content/rooms.json`) tienen hoy `capacity: 2` — Individual, Matrimonial y Doble admiten hasta 2 huéspedes cada una. El selector de ocupación (1/2) aplica entonces a las tres habitaciones actuales, no solo a la Doble; lo que varía por habitación es si tiene **tarifas diferenciadas** configuradas o usa el **precio único de respaldo** (`rooms.base_nightly_price_clp`, sin tocar).
- `rooms` no tiene hoy ninguna tabla de tarifas por ocupación; el precio es un único entero (`base_nightly_price_clp`).
- El carro público (`selection-session.ts`, `sessionStorage`) guarda hoy `{ checkIn, checkOut, rooms: string[] }` — solo IDs de habitación, sin ocupación ni el tamaño del grupo buscado.
- `searchAvailability` (`src/features/availability/search.ts`) filtra candidatos con `room.capacity >= guests` (huéspedes totales de la búsqueda), lo que hoy excluye una habitación que no puede alojar sola a todo el grupo.
- `buildReservationQuote` / `computeReservationPricing` (`src/features/reservations/quote.ts`, `pricing.ts`) ya reciben un `nightlyPriceClp` resuelto por el llamador y no conocen tarifas por ocupación; son la fuente autoritativa de totales y no cambian su contrato.
- `reservation_holds` ya tiene `guest_count` por habitación (una habitación por hold). `reservation_items` (líneas de una reserva confirmada, potencialmente multi-habitación) NO tiene `guest_count` — solo `reservations.guest_count` a nivel de reserva completa.
- El patrón de admin ya usado para "un precio editable" es `breakfast-catalog-settings.tsx` (fetch + PUT a una API de settings) y el de "gestión por habitación" es `admin-room-image-management` (`/admin/habitaciones/[id]/fotos`).

## Goals / Non-Goals

**Goals:**
- Resolver el precio por noche de una habitación a partir de su ocupación (1 o 2), con respaldo a un precio único cuando no hay tarifas configuradas.
- Permitir al admin configurar, por habitación, tarifas diferenciadas o un precio fijo.
- Permitir en el sitio público elegir ocupación por habitación y repartir el grupo buscado entre varias habitaciones, sin superar el total buscado.
- Mantener el precio final de una reserva siempre calculado en el servidor a partir de la ocupación real de cada ítem, nunca confiado del cliente.

**Non-Goals:**
- No se rediseña el flujo de pago ni se agrega soporte multi-habitación al pago online (`pay_now`) si no lo tiene hoy; este cambio solo asegura que el precio que llega a cualquier flujo de checkout ya sea el correcto para la ocupación elegida.
- No se extiende el formulario de reserva manual del admin (`manual-reservation-form.tsx`) a ocupación por habitación — sigue con su campo único de huéspedes.
- No se modela ocupación más allá de 1-2 personas por habitación en esta iteración (ninguna habitación real admite hoy más de 2).

## Decisions

### 1. Modelo de datos: tabla `room_occupancy_prices`, no columnas fijas en `rooms`

Una tabla `room_occupancy_prices(id, room_id, occupancy, price_clp, created_at, updated_at)` con `unique(room_id, occupancy)`, en vez de columnas `price_1_clp`/`price_2_clp` en `rooms`.

- **Por qué**: el pedido explícito es "dejarlo listo para las demás habitaciones" sin otra migración de schema cuando cambie qué ocupaciones se tarifican. Una tabla generaliza a cualquier ocupación futura (ej. 3+ si algún día una habitación crece de capacidad) sin agregar columnas.
- **Alternativa descartada**: columnas fijas en `rooms` — más simple hoy, pero obliga a otra migración si se necesita una tercera tarifa.
- **Cero fila = respaldo**: una habitación sin filas en esta tabla usa `rooms.base_nightly_price_clp` para cualquier ocupación (comportamiento actual sin cambios, válido hoy para Individual y Matrimonial).
- **"Precio fijo" no es una columna aparte**: al guardar desde el admin, si la casilla "mismo precio" está marcada, se escribe una fila por cada ocupación (1 y 2) con el mismo `price_clp`. No existe un flag persistido de "es fijo"; ese estado es una conveniencia del formulario de edición (ver Decisión 4), no una regla de negocio que otra parte del sistema necesite leer. Riesgo aceptado: ver Risks.
- **Validación `occupancy <= capacity`**: se aplica en la capa de dominio (`room-occupancy-pricing`), no como constraint SQL cruzada entre tablas, siguiendo el patrón ya usado en el resto del schema para invariantes de una sola tabla.

### 2. Resolución de precio: nueva función de dominio, no cambia `pricing.ts`

Nueva función `resolveRoomNightlyPrice(room, occupancyPrices, guestCount)` en el dominio de habitaciones (junto a `RoomReadModel`). Devuelve el precio de la ocupación exacta si existe, o `room.baseNightlyPriceClp` si la habitación no tiene tarifas configuradas.

- **Por qué separada de `pricing.ts`**: `computeReservationPricing`/`computeMultiRoomReservationPricing` ya son la fuente autoritativa de totales y reciben `nightlyPriceClp` ya resuelto; mantenerlas así evita tocar un módulo ya probado y usado por todos los flujos de checkout (pay_now, pay_at_property, admin manual, channel-sync). Los llamadores que arman la cotización (`create-hold.ts`, `create-pay-at-property-reservation.ts`, la composición de resultados de disponibilidad) resuelven el precio por ocupación **antes** de llamar a `pricing.ts`.
- **Server-autoritativo**: el precio mostrado en cliente (resultados, detalle, carro) es una réplica de la misma función de resolución para UX inmediata, pero el precio cobrado siempre se resuelve de nuevo en el servidor a partir de la ocupación real del ítem, igual que hoy con `nightlyPriceClp`.

### 3. Se elimina el filtro `capacity >= guests totales` en la búsqueda

`searchAvailability` deja de descartar una habitación porque no alcanza para todo el grupo. El filtro que queda es solo disponibilidad (fechas). El límite de ocupación pasa a vivir en la UI/estado del carro (Decisión 5): nunca se permite que la suma de ocupaciones elegidas supere los huéspedes buscados, pero eso ya no bloquea qué habitaciones aparecen como resultado.

- **Por qué**: es el cambio central pedido — repartir un grupo entre varias habitaciones exige que todas aparezcan como candidatas, no solo las que caben solas.
- **La ocupación elegida no afecta el bloqueo de disponibilidad de la habitación** (ver proposal.md): `checkRoomAvailability`/`occupancy.ts` no cambian. Una habitación agregada queda 100% ocupada para esas fechas sin importar si se le asignaron 1 o 2 personas — el reparto solo decide precio y cupo del grupo.

### 4. El carro pasa de `rooms: string[]` a `rooms: {roomId, guestCount}[]`, con el total buscado

`SessionRoomSelection` (sessionStorage) gana `guests: number` (el total buscado, capturado en la primera búsqueda) y cambia `rooms: readonly string[]` a `rooms: readonly { roomId: string; guestCount: number }[]`. Se sube la versión de la clave de almacenamiento (`vista-valle.public-room-selection.v1` → `.v2`) para no interpretar el formato viejo como válido; una entrada v1 existente simplemente se descarta (el carro se ve vacío), sin migración de datos porque es estado efímero de sesión, no persistido en servidor.

- **Por qué versionar en vez de migrar**: es `sessionStorage`, dura una sesión de navegador; no hay reservas a medio hacer que preservar entre versiones de la app.
- **Guardar `guests` (el total buscado) junto a la selección**: es lo que permite mostrar "huéspedes asignados: X de Y" en cualquier página (resultados, detalle, carro, pre-reserva) sin volver a pedirlo.

### 5. Bloqueo de sobre-asignación en la capa de presentación pública

La regla "no permitir superar el total buscado" (specs: `availability-search-experience` → Reparto de huéspedes) se implementa como lógica derivada y compartida (un helper puro: cuántos huéspedes ya asignados, cuánto queda, qué opciones/habitaciones deshabilitar), consumida tanto por la tarjeta de resultados como por el detalle de habitación y el resumen del carro, para que los tres queden consistentes sin duplicar la regla.

### 6. Admin: nueva ruta y API por habitación, mismo patrón que fotos y desayuno

- Vista: `/admin/habitaciones/[id]/tarifas`, enlazada desde el listado existente en `/admin/habitaciones` (junto al enlace ya existente "Gestionar fotos").
- API: `GET`/`PUT /api/admin/habitaciones/[id]/tarifas`, siguiendo el patrón de `breakfast-catalog-settings.tsx` (fetch en cliente + PUT con validación server-side de enteros positivos en CLP).
- Auditoría: reutiliza el mecanismo ya usado por `admin-room-image-management` (actor + fecha por operación), sin diseñar uno nuevo.

### 7. `reservation_items` gana `guest_count` por ítem

Se agrega `guest_count integer not null` a `reservation_items`, análogo a como `reservation_holds` ya lo tiene por habitación. Es necesario para: (a) registrar con qué ocupación se cobró cada línea (auditoría/consistencia con `nightly_price_clp` ya congelado), y (b) que el admin pueda ver, por reserva confirmada, cuántas personas fueron asignadas a cada habitación.

- **Backfill de filas existentes**: ver Open Questions — no cambia el enfoque ni las specs, solo el detalle exacto del valor de relleno para reservas históricas.

## Risks / Trade-offs

- **["Mismo precio" no persiste como flag]** → si otra parte del sistema necesitara saber "esta habitación está en modo precio fijo" sin comparar dos valores, habría que agregar el flag entonces. Mitigación: hoy solo el formulario de edición necesita ese estado, y lo deriva comparando `price_clp` de occupancy 1 y 2 al cargar.
- **[Filas parcialmente configuradas en `room_occupancy_prices`]** → si por un bug o edición manual una habitación queda con una sola fila (ej. solo occupancy=1) en vez de cero o dos, `resolveRoomNightlyPrice` no tendría una regla clara. Mitigación: la función de resolución cae a `base_nightly_price_clp` en cualquier estado que no sea "exactamente coincide la ocupación pedida", y el admin siempre escribe ambas filas atómicamente (Decisión 1), por lo que este estado solo podría originarse fuera de la UI de admin.
- **[Quitar el filtro de capacidad total cambia qué se considera "sin disponibilidad"]** → una búsqueda de 4 huéspedes hoy mostraría "sin disponibilidad" (ninguna habitación tiene capacidad 4); tras el cambio seguirá sin colapsar en una sola habitación, pero mostrará las 3 habitaciones de a 2, cuya suma de capacidades (6) sí alcanza. Esto es el comportamiento buscado, pero vale confirmarlo explícitamente porque cambia qué visitantes antes veían "sin disponibilidad" y ahora ven resultados que deben repartir.

## Migration Plan

1. Migración Drizzle: crear `room_occupancy_prices` + agregar `reservation_items.guest_count`.
2. Backfill de datos: insertar en `room_occupancy_prices` las tarifas iniciales de la Habitación Doble (1 persona / 2 personas, valores a definir por el negocio); Individual y Matrimonial quedan sin filas (respaldo a su `base_nightly_price_clp` actual, sin cambio de precio percibido).
3. Backfill de `reservation_items.guest_count` para filas existentes (ver Open Questions).
4. Sin rollback especial requerido: la tabla nueva y la columna nueva son aditivas; revertir el cambio de código vuelve a ignorar ambas sin romper datos existentes.

## Open Questions

- Backfill exacto de `reservation_items.guest_count` para reservas históricas ya confirmadas (ej. `reservations.guest_count` tope-limitado a la capacidad de cada ítem, vs. un valor fijo por defecto). No cambia el enfoque ni las specs; se resuelve al escribir la migración.
- Valores iniciales de precio para 1 y 2 personas de la Habitación Doble (dato de negocio, no técnico).
