## Why

Están llegando reservas que necesitan cambios de habitaciones después de creadas: el huésped pide otra cabaña, avisa que vienen dos personas más, o libera una de las habitaciones que reservó. Hoy el panel solo permite mover las fechas: el set de habitaciones y la cantidad de personas por habitación quedan congelados en el momento de la creación, y la única salida es cancelar y volver a crear la reserva, lo que pierde el historial, los pagos y la trazabilidad.

El eje fechas ya resolvió el problema difícil —recálculo autoritativo, bloqueo de habitaciones, conciliación de pagos y auditoría transaccional—, pero lo resolvió para un solo eje. Este cambio generaliza esa operación a la estadía completa en vez de construir una segunda implementación paralela del mismo recálculo.

## What Changes

- **BREAKING (interfaz administrativa)**: el formulario de edición de fechas del detalle de reserva se reemplaza por un formulario único de **edición de estadía** que envía en un mismo submit las fechas, el set de habitaciones y la cantidad de personas por habitación. El administrador que hoy necesita mover una fecha *y* cambiar de habitación deja de hacer dos ediciones, con dos recálculos, dos auditorías y dos correos.
- La operación admite los tres ejes de habitación: **cambiar la cantidad de personas** de una habitación que se conserva, **agregar** una habitación y **quitar** una habitación.
- El recálculo del valor pasa a considerar el precio por ocupación de cada habitación resultante, no solo las noches: cambiar la cantidad de personas de una habitación cambia su tarifa aunque las fechas no se muevan.
- Quitar la última habitación de una reserva se rechaza como resultado de negocio: una reserva sin habitaciones no es representable en el dominio.
- La disponibilidad que consulta el formulario deja de heredar la regla pública de "entrada no antes de hoy". Sin esto, la feature no podría cambiar la habitación de una reserva **ya en curso**, que es justamente el caso que está llegando.
- El bloqueo de concurrencia se toma sobre la unión de las habitaciones actuales y las nuevas, de modo que agregar una habitación no pueda carrerear con otra reserva que la esté tomando en el mismo intervalo.
- La auditoría y el correo administrativo pasan a describir el cambio de estadía completo —fechas, habitaciones entrantes y salientes, y personas por habitación—, no solo el cambio de fechas.
- La advertencia de sincronización manual que hoy acompaña al cambio de fechas gana su versión para habitaciones: mover una reserva a una habitación **sin conexión de canal activa** cambia de forma silenciosa el comportamiento de sincronización con Airbnb y Booking, y el administrador debe verlo antes de confirmar.
- **No cambia**: la elegibilidad de la reserva (sigue siendo cualquier origen y cualquier estado), el criterio de notificación (sigue siendo solo al destinatario administrativo, nunca al huésped), la conciliación de pagos ya especificada para el eje fechas, ni el flujo público de reservas.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `reservation-date-editing`: la operación deja de estar acotada a `check-in`/`check-out` y pasa a cubrir la estadía completa. Se amplían los cuatro requisitos existentes —edición transaccional, elegibilidad, recálculo autoritativo, y auditoría y comunicación— para incorporar el set de habitaciones y la ocupación por habitación, y se agregan requisitos para el rechazo de la reserva sin habitaciones, la disponibilidad sin regla de fecha mínima y la advertencia de sincronización por habitación. El nombre del directorio de la capability se conserva para no romper el historial de archivado; su `Purpose` se reescribe al alcance real.
- `reservation-administration`: el requisito "Gestión de reservas" hoy promete "modificar fechas de estadía" y un detalle que "ofrece controles de edición de fechas y de datos de contacto"; ambos pasan a describir la edición de estadía. El requisito "Auditoría administrativa" incorpora el cambio de estadía entre las operaciones sensibles con actor y diferencia registrada.

## Impact

- **Código afectado**: el caso de uso de edición de fechas de `src/features/reservations/` se generaliza a un caso de uso de estadía y el eje fechas pasa a delegar en él; el adapter Drizzle de `reservation-repository.ts` necesita un diff de tres vías sobre `reservation_items` (hoy solo hace `UPDATE` por `roomId`); se agrega un BFF de disponibilidad propio para la edición; la Server Action administrativa y el formulario del detalle de reserva se reemplazan por su versión de estadía; la plantilla del correo administrativo y el evento de auditoría amplían su contenido.
- **Sin cambio de esquema**: los cargos ya viven denormalizados como `charges_clp` dentro de `reservation_items`, así que quitar una habitación se lleva su cargo con el ítem y no deja filas huérfanas. El `guestCount` de la reserva se deriva de la suma de sus ítems, por lo que no hay denormalización que mantener.
- **Riesgo de regresión**: el eje fechas está en producción y se reimplementa sobre el caso de uso nuevo; hay que cubrir con pruebas el swap de habitación, el agregar, el quitar, el cambio de solo ocupación, el rechazo al quitar la última habitación, la edición de una reserva con `check-in` pasado y el recálculo cuando el total nuevo queda por debajo de lo ya pagado.
- **Consecuencia aceptada explícitamente**: manteniendo la elegibilidad de cualquier estado, editar la estadía de una reserva cancelada pasa el chequeo de disponibilidad de forma trivial, porque la ocupación solo considera reservas confirmadas. Es coherente con el eje fechas y queda registrado como decisión, no como omisión.
- **Sin cambios** en el flujo público de reservas, en los proveedores de pago, en el feed iCal saliente (se deriva de la ocupación, por lo que el cambio de habitación se refleja solo) ni en la notificación al huésped.
