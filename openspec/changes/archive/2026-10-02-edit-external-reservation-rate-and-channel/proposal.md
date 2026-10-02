## Why

El valor por noche de una reserva lo resuelve siempre el servidor desde la tarifa vigente de la habitación, y eso es correcto para el flujo público: nadie debe poder enviar un precio desde el navegador. Pero las reservas que el administrador ingresa a mano por Airbnb y Booking no cobran la tarifa de la web. El canal fija su propio valor —comisión, promoción, tarifa negociada— y hoy no hay forma de registrarlo: la reserva queda guardada con un total que no es el que el huésped pagó. Como los ingresos del panel se derivan de los pagos de la reserva, cada reserva de canal externo deja el resumen del mes descuadrado.

El segundo problema es más simple y del mismo origen: el canal se elige al crear la reserva a mano y no se puede corregir después. Una reserva ingresada como Airbnb cuando era de Booking queda mal atribuida para siempre en el desglose por canal del panel.

## What Changes

- El administrador puede fijar a mano el valor por noche de cada habitación de una reserva de canal externo (`origin` `airbnb` o `booking`), tanto al crearla como en cualquier momento posterior.
- La sobrescritura queda marcada como manual y **se conserva**: una edición posterior de la estadía recalcula noches y total, pero no la devuelve a la tarifa vigente de la habitación.
- Al fijar un valor se recalculan el subtotal de la habitación, el total de la reserva y la conciliación de pagos, para que el resumen mensual del panel cuadre.
- La edición no tiene restricción de estado: también opera sobre reservas `completed`, `cancelled` y `no_show`. En una reserva cancelada es corrección de registro, no de resumen — el panel solo cuenta `confirmed` y `completed`.
- El administrador puede corregir el canal de una reserva entre `airbnb` y `booking`, para arreglar un error de ingreso.
- Los precios base y la resolución de tarifa por ocupación **no cambian**. La sobrescritura es por reserva; nada toca la configuración de la habitación ni la cotización del sitio público.
- Las reservas de la web (`origin` `website`) quedan fuera: siguen con el precio resuelto por el servidor, sin campo editable.

Supuestos registrados, derivados de que la sincronización iCal no está en uso hoy:

- Este change no define comportamiento de sincronización. No se reevalúa `paymentBehavior` de `channel_connections` al corregir el canal, y no se diseñan salvaguardas de idempotencia para el sondeo entrante.
- `externalPlatform` acompaña a `origin` cuando la reserva lo tiene poblado, por coherencia del registro. En la práctica no aplica: las reservas que el administrador crea a mano lo tienen en NULL.

## Capabilities

### New Capabilities

- `reservation-rate-and-channel-editing`: edición administrativa del valor por noche y del canal de una reserva de canal externo — qué es elegible, cómo se recalculan total y pagos, cómo persiste la sobrescritura frente a ediciones posteriores, y qué queda auditado.

### Modified Capabilities

- `reservation-date-editing`: el requisito «Recálculo autoritativo del valor» hoy obliga a re-resolver la tarifa vigente por ocupación en toda edición de estadía. Pasa a respetar el valor por noche marcado como manual para las habitaciones que lo tengan, sin dejar de rechazar precios y totales enviados por el navegador.
- `reservation-administration`: el requisito «Reservas manuales multicanal» incorpora el valor por noche opcional en la creación manual de una reserva de canal externo, y se agrega la corrección del canal de una reserva ya creada con su auditoría.

## Impact

- `src/persistence/schema.ts`: `reservation_items` necesita distinguir un valor por noche manual de uno resuelto desde la tarifa; `reservation_items_nightly_price_positive` ya exige un valor mayor que cero, y la validación de entrada debe respetarlo.
- `src/features/reservations/edit-reservation-stay.ts`: `recalculateReservationStayPricing` deja de re-resolver incondicionalmente el precio de cada habitación. `computeReservationStayEditFinancialSummary` se reutiliza sin cambios para la conciliación de pagos.
- `src/features/reservations/reservation-repository.ts`: el contrato del repositorio y ambas implementaciones (mock y Drizzle) transportan el valor manual y la corrección de canal.
- `src/features/admin/manual-reservation*.ts` y su formulario: campo de valor por noche por habitación, visible solo para `origin` `airbnb` o `booking`.
- `src/features/admin/edit-reservation-stay-form.tsx` y una entrada nueva para corregir el canal en el detalle administrativo.
- `src/infrastructure/database/admin-dashboard-summary-source.ts`: no cambia, pero es el consumidor que motiva el recálculo — `approvedRevenueClp` y `channelBreakdown` (agrupado por `origin`) pasan a reflejar los valores corregidos.
- Auditoría administrativa: dos eventos nuevos, valor por noche y canal.
