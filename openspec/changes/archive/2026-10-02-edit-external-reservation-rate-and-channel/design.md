## Context

Ver proposal.md «Why» para la motivación.

Tres hechos del código vigente condicionan el diseño:

1. **El precio por noche se re-resuelve en cada edición de estadía.** `recalculateReservationStayPricing` en `src/features/reservations/edit-reservation-stay.ts` llama a `resolveRoomNightlyPrice` con la tarifa *actual* de la habitación para la ocupación *solicitada*, y su contrato está documentado como «nothing here accepts a caller-supplied price or total». Esa invariante es correcta para el flujo público y es justamente la que hay que relajar de forma controlada.
2. **El total siempre es derivado.** `computeReservationPricing` en `src/features/reservations/pricing.ts` calcula `nights * nightlyPriceClp + chargesClp` y nunca acepta un total externo. El valor por noche, en cambio, ya es un parámetro de entrada de esa función. La sobrescritura entra un nivel más arriba, en la resolución de la tarifa, y la invariante del total queda intacta.
3. **La conciliación de pagos ya existe y es pura.** `computeReservationStayEditFinancialSummary` calcula `pendingBalanceClp = max(total - aprobados, 0)`, el sobrepago inverso, y una `paymentAction` (`set_pending` / `cancel_pending` / `none`). Es exactamente el criterio que el resumen mensual necesita, y no hay que reimplementarlo.

Restricciones de la base de datos: `reservation_items.nightly_price_clp` es `integer not null` con el check `reservation_items_nightly_price_positive` (`> 0`), así que la sobrescritura debe validarse como entero mayor que cero antes de llegar a Postgres. El resumen del panel (`src/infrastructure/database/admin-dashboard-summary-source.ts`) deriva `approvedRevenueClp` de los pagos aprobados y agrupa `channelBreakdown` por `origin`, con `validStatuses = ["confirmed", "completed"]`.

La sincronización iCal entrante queda fuera del alcance por decisión del usuario: no está en uso. Este documento no define comportamiento de sondeo, idempotencia ni `paymentBehavior`.

## Goals / Non-Goals

**Goals:**

- Una sola representación del valor por noche efectivo, para que ningún consumidor existente (subtotales, total, resumen del panel, feed saliente) tenga que aprender a elegir entre dos columnas.
- La sobrescritura sobrevive a una edición de estadía posterior sin que `editReservationStay` deje de ser el único punto transaccional de la estadía.
- Reutilizar la conciliación de pagos existente en lugar de escribir una segunda.

**Non-Goals:**

- No se introduce un historial de tarifas por reserva: la sobrescritura es el valor actual, y el rastro de los valores anteriores vive en la auditoría, no en una tabla nueva.
- No se toca la resolución de precio por ocupación ni la cotización pública.
- No se define comportamiento de sincronización con canales externos.

## Decisions

### 1. Una marca booleana por línea, no una segunda columna de precio

`reservation_items` gana una columna `nightly_price_manual boolean not null default false`. `nightly_price_clp` sigue siendo el valor por noche **efectivo** en todos los casos; la marca solo indica su procedencia.

*Por qué:* todo consumidor actual lee `nightly_price_clp` y seguirá leyendo el valor correcto sin cambio alguno — subtotales, total, resumen del panel, detalle administrativo, feed iCal saliente. La marca es un dato de procedencia que solo gobierna una decisión: si el recálculo vuelve a resolver la tarifa o conserva lo que hay.

*Alternativa considerada:* una columna `nightly_price_override_clp` nullable, con `nightly_price_clp` manteniendo siempre la tarifa resuelta. Descartada porque obliga a cada lector a calcular `override ?? base` para obtener el valor efectivo, y cualquier lector que se olvide informa un monto que el huésped no pagó. El beneficio que ofrece —recordar la tarifa base de la que se partió— no lo necesita ninguna spec, y la auditoría ya conserva el valor anterior.

*Consecuencia del default:* `false` para toda fila existente, que es lo correcto: ninguna reserva tiene hoy un valor fijado a mano. La migración no necesita backfill.

### 2. La sobrescritura entra en la resolución de la tarifa, no en el cálculo del total

`recalculateReservationStayPricing` pasa a recibir, junto a las tarifas vigentes, el conjunto de valores manuales de la reserva por `roomId`. Para cada habitación solicitada: si tiene valor manual, lo usa; si no, llama a `resolveRoomNightlyPrice` como hoy. Una habitación que entra nueva a la estadía nunca tiene valor manual, así que toma la tarifa vigente sin caso especial.

*Por qué:* mantiene intacta la invariante que importa —`computeMultiRoomReservationPricing` sigue derivando noches, subtotales y total, y sigue sin aceptar un total del llamador— y la relaja solo en el punto donde el administrador tiene autoridad legítima. El valor manual llega desde el registro persistido de la reserva, no desde el navegador, incluso en una edición de estadía.

*Alternativa considerada:* que `editReservationStay` recibiera los precios por habitación en su input. Descartada: convertiría el precio en un dato enviable por el cliente en la ruta de edición de estadía, que es exactamente lo que la spec vigente prohíbe.

### 3. Dos operaciones separadas, con garantías distintas

**Valor por noche** — un caso de uso transaccional nuevo en `src/features/reservations`, hermano de `editReservationStay`: re-lee la reserva, valida la elegibilidad por origen y el valor, recalcula subtotales y total con el valor nuevo, concilia los pagos con `computeReservationStayEditFinancialSummary`, y escribe líneas, pagos y auditoría en una transacción.

Usa `roomLockGateway.runLockedMany`, no `runExclusiveMany`: el valor por noche no cambia fechas ni habitaciones, así que no hay nada que revalidar en disponibilidad. `runLockedMany` da la transacción y el bloqueo de filas sin el chequeo de solapamiento, que aquí sería ruido.

**Canal** — una actualización no transaccional, siguiendo el patrón de `updateInvoiceRequest` en el repositorio: cambia `origin`, escribe auditoría, y no necesita `TContext` ni bloqueo porque no toca fechas, precios, pagos ni estado. Cuando la reserva tiene `externalPlatform` poblado, se mueve junto a `origin` para no dejar el registro contradictorio; en las reservas que el administrador crea a mano ese campo es NULL y no aplica.

*Por qué separadas:* tienen superficies de riesgo distintas. Juntarlas en una operación obligaría a la corrección de canal —que no mueve un peso— a pasar por una transacción con bloqueo de filas y conciliación de pagos.

### 4. Descartar la sobrescritura es la misma operación con el valor ausente

Volver a la tarifa vigente no es un endpoint aparte: es la operación de valor por noche con la sobrescritura ausente para esa habitación. Pone la marca en `false` y re-resuelve desde la tarifa, con el mismo recálculo de total y la misma conciliación de pagos.

*Por qué:* el efecto sobre total y pagos es idéntico al de fijar un valor, así que un segundo camino solo duplicaría la conciliación.

### 5. La elegibilidad por origen es un predicado compartido

Un único predicado decide si una reserva admite sobrescritura y corrección de canal: `origin ∈ {airbnb, booking}`. Lo consumen la compuerta de la interfaz y la validación del servidor, siguiendo el patrón que `assertReservationStayEditable` ya estableció como punto único de elegibilidad.

*Por qué:* la interfaz oculta el campo y el servidor lo rechaza por la misma razón, así que una sola definición evita que divergan. La compuerta de la interfaz no es un control de seguridad; la validación del servidor sí.

*Nota sobre el estado:* a diferencia del origen, el estado no restringe nada. `confirmed`, `completed`, `cancelled` y `no_show` son todos editables, igual que en `assertReservationStayEditable`. En una reserva cancelada la edición es corrección de registro: el resumen del panel solo cuenta `confirmed` y `completed`, así que no mueve ningún ingreso informado.

## Risks / Trade-offs

**Un consumidor nuevo podría leer la marca como si fuera el precio** → `nightly_price_clp` es el valor efectivo siempre y en todos los casos; la marca no participa de ningún cálculo monetario. El comentario de la columna en el esquema debe decirlo, siguiendo la convención de documentación de `src/persistence/schema.ts`.

**La sobrescritura sobrevive a un cambio de ocupación que el administrador esperaba que la recalculara** → es el comportamiento que el usuario eligió explícitamente, y la mitigación es que la spec exige distinguir en el detalle qué habitaciones tienen valor manual, más la vuelta a la tarifa vigente en un clic.

**Editar el valor de una reserva cancelada puede crear un pago pendiente sobre una reserva que nadie va a cobrar** → la conciliación actual produce `set_pending` cuando el total supera lo pagado, sin mirar el estado. Hay que verificar el comportamiento sobre una reserva cancelada durante la implementación y, si resulta confuso, que la operación no genere un pendiente en reservas canceladas: en una cancelada la edición es corrección de registro y un saldo por cobrar no tiene sentido operativo. Queda como tarea de verificación explícita, no como supuesto.

**Un total que ya no coincide con lo que el canal externo muestra** → inevitable y fuera de alcance: el valor lo fija el canal y este change solo registra lo que el administrador sabe. Nada se propaga a Airbnb ni a Booking, igual que advierte hoy la spec de edición de estadía.

## Migration Plan

1. Migración de esquema: agregar `nightly_price_manual` con default `false` y `not null`. Aditiva, sin backfill, compatible con el código anterior — una versión previa de la aplicación ignora la columna y sigue funcionando.
2. Desplegar el dominio y el repositorio, luego la interfaz. La columna sin interfaz que la escriba deja el sistema en su comportamiento actual.
3. Rollback: revertir la aplicación. La columna puede quedar; con `false` en todas las filas, el comportamiento es el previo al change. Solo hace falta borrarla si se abandona la capacidad.
