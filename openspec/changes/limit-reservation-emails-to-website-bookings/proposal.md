## Why

Hoy toda reserva confirmada encola los dos correos de confirmación —el del huésped y la alerta administrativa— sin mirar su origen. Las reservas que un administrador ingresa desde el panel (teléfono, WhatsApp, Airbnb, Booking, admin) ya se acordaron por ese canal antes de existir en el sistema: el huésped recibe una confirmación duplicada, o directamente inesperada cuando reservó por Airbnb o Booking y nunca dio su correo a Vista Valle, y el administrador recibe una alerta de una reserva que acaba de crear él mismo.

Además, ninguno de los dos correos nombra a quien reservó: la alerta administrativa obliga a abrir el panel solo para saber de quién es la reserva, y la confirmación al huésped no lo saluda.

## What Changes

- Solo una reserva con `origin = website` SHALL encolar notificaciones de confirmación. Una reserva creada desde el panel de administración —cualquier origen distinto de `website`— no encola el correo al huésped ni la alerta administrativa.
- La confirmación al huésped SHALL saludarlo por su nombre.
- La alerta administrativa SHALL nombrar al huésped que reservó.
- La decisión de notificar queda en un único predicado de dominio sobre el origen, usado por la creación con pago al llegar y por la confirmación de pago online, en vez de depender de qué composición inyectó el writer de outbox.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactional-notifications`: acota la confirmación al huésped y la alerta administrativa a las reservas originadas en el sitio web, y agrega el nombre del huésped a ambos correos.

## Impact

- `src/features/reservations/create-pay-at-property-reservation.ts`: expone el predicado de origen notificable y omite la escritura al outbox cuando el origen no es `website`.
- `src/features/reservations/confirm-pay-now-reservation.ts`: aplica el mismo predicado sobre el origen de la reserva creada.
- `src/features/notifications/email-templates.tsx` y `src/features/notifications/email-template-renderer.ts`: agregan el nombre del huésped a la confirmación y a la alerta administrativa.
- `src/features/notifications/template-data-source.ts` y `src/infrastructure/database/notification-template-data-source.ts`: resuelven el nombre del huésped de la reserva para la plantilla.
- `src/features/admin/manual-reservation.ts`: sigue inyectando el writer; la decisión ya no depende de la composición, de modo que ninguna ruta del admin puede volver a notificar por omisión.
