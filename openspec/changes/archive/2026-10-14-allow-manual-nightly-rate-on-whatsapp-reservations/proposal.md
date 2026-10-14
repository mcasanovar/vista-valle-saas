## Why

El valor por noche fijado a mano hoy está disponible solo en reservas de Airbnb y Booking, bajo el supuesto de que únicamente un canal externo cobra un precio que la propiedad no fijó. Las reservas que llegan por WhatsApp se negocian igual: el administrador acuerda un precio con el huésped —un descuento, una tarifa de temporada conversada, un paquete— y hoy no tiene dónde registrarlo, así que la reserva queda guardada con la tarifa vigente de la habitación y el total y el resumen de ingresos no reflejan lo que el huésped realmente pagó.

## What Changes

- El origen `whatsapp` pasa a admitir un valor por noche fijado a mano, con exactamente las mismas reglas que Airbnb y Booking: por habitación, monto entero en pesos mayor que cero, sin restricción por estado de la reserva, recálculo de subtotal y total en el servidor, conciliación de pagos con el mismo criterio y auditoría del cambio.
- El formulario de creación manual ofrece el campo de valor por noche cuando el origen elegido es WhatsApp, además de Airbnb y Booking.
- El detalle administrativo de una reserva de WhatsApp muestra el formulario de edición del valor por noche.
- La corrección de origen deja de descartar los valores fijados a mano cuando el destino es WhatsApp: corregir entre Airbnb, Booking y WhatsApp es una relabelación pura. Corregir a `website`, `phone` o `admin` sigue descartándolos y recalculando.
- `phone`, `website` y `admin` **no** cambian: siguen sin admitir un valor propio.
- El criterio deja de llamarse "canal externo" y pasa a nombrarse por lo que decide —qué orígenes admiten un valor por noche propio—, porque WhatsApp no es un canal externo sincronizable. El concepto de plataforma externa sincronizable (`ExternalReservationPlatform`, los avisos de "esto no se refleja en Airbnb") sigue siendo solo Airbnb y Booking y no se toca.
- Los textos de la interfaz que hoy dicen "lo que cobró el canal" se vuelven neutrales respecto al origen.

## Capabilities

### New Capabilities

Ninguna.

### Modified Capabilities

- `reservation-rate-and-channel-editing`: los requisitos de elegibilidad por origen, de creación manual con valor propio y de descarte del valor al corregir el origen pasan a incluir `whatsapp`.
- `reservation-administration`: el requisito de reservas manuales multicanal pasa a ofrecer el valor por noche también en WhatsApp.

## Impact

- `src/features/reservations/reservation-rate-eligibility.ts`: la lista de orígenes elegibles y el renombre del criterio.
- `src/features/reservations/edit-reservation-nightly-rates.ts`, `src/features/reservations/edit-reservation-origin.ts`: consumen el criterio renombrado.
- `src/features/admin/manual-reservation.ts`, `src/features/admin/manual-reservation-form.tsx`, `src/features/admin/edit-reservation-nightly-rates-core.ts`, `src/features/admin/edit-reservation-nightly-rates-form.tsx`: puerta de la interfaz, validación de creación y mensajes.
- `app/(admin-protected)/admin/reservas/[id]/page.tsx`: separa la puerta del formulario de tarifas del aviso de plataforma externa, que hoy comparten una misma condición.
- Sin migraciones: `nightlyPriceManual` ya existe por línea de reserva y el enum `reservation_origin` ya incluye `whatsapp`.
- Sin impacto en el sincronizador de calendarios ni en la sincronización de canales.
