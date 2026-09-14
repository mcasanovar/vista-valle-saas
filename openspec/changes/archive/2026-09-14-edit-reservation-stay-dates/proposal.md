## Why

Las reservas confirmadas actualmente solo permiten cambios de estado y no permiten corregir o extender las fechas de estadía desde la administración. Esto obliga a crear reservas nuevas o resolver manualmente casos frecuentes en que un huésped cambia su `check-in` o `check-out`, con riesgo de perder disponibilidad, totales y trazabilidad.

## What Changes

- Permitir a un administrador autorizado editar `check-in` y `check-out` de reservas propias o manuales con origen `website`, `phone`, `whatsapp` o `admin`.
- Rechazar la edición de reservas originadas en `airbnb` o `booking`, tanto en la interfaz como en la operación de dominio.
- Revalidar atómicamente las nuevas fechas para todas las habitaciones de una reserva, excluyendo la propia reserva del cálculo de conflictos.
- Recalcular noches, cargos y total con las fechas editadas.
- Mantener los pagos históricos; si el nuevo total supera lo pagado, crear un nuevo saldo pendiente por la diferencia.
- Si el nuevo total es menor que lo pagado, conservar los pagos y registrar el sobrepago como una resolución financiera manual, sin devolución automática.
- Registrar auditoría con actor, fechas, totales y estado financiero anterior y posterior.
- Actualizar el detalle administrativo, los saldos pendientes, las notificaciones y las tareas de sincronización que correspondan.

## Capabilities

### New Capabilities

- `reservation-date-editing`: modificación transaccional de fechas, disponibilidad y total de una reserva elegible.

### Modified Capabilities

- `reservation-administration`: permitir la edición autorizada de fechas en reservas propias/manuales, con exclusión de Airbnb y Booking y auditoría del cambio.
- `payment-processing`: soportar saldos pendientes adicionales y sobrepagos manuales derivados de una modificación de reserva, sin mutar pagos históricos.

## Impact

- Panel administrativo, detalle de reserva y acciones server-side de edición.
- Servicios de dominio de reservas, bloqueo por habitación, pricing y repositorios mock/Drizzle.
- Modelo y migraciones de pagos, auditoría y posibles ajustes de reserva.
- Cálculo de disponibilidad y feed/tareas de sincronización de Airbnb y Booking.
- Outbox de notificaciones y pruebas unitarias, de integración y end-to-end.
