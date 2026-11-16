## 1. Acotar las notificaciones a las reservas del sitio web

- [x] 1.1 Exponer en `src/features/reservations/create-pay-at-property-reservation.ts` un predicado de dominio sobre `ReservationOrigin` que decida si una reserva confirmada notifica, y reexportarlo desde `src/features/reservations/index.ts`.
- [x] 1.2 Aplicar el predicado en `createMultiRoomPayAtPropertyReservation`: con un origen distinto de `website` la reserva se crea igual y devuelve `notificationOutboxIds: []` sin tocar el outbox.
- [x] 1.3 Aplicar el mismo predicado en `confirmPayNowReservationFromHold` sobre el origen de la reserva creada.
- [x] 1.4 Verificar con tests unitarios que una reserva manual de cada origen no encola intents y que la reserva, su pago y su huésped sí se persisten.
- [x] 1.5 Verificar con test que la reserva web (pago al llegar y pago online) sigue encolando los intents de huésped y administrador.

## 2. Nombre del huésped en los correos

- [x] 2.1 Agregar el nombre del huésped al contrato de datos de plantilla en `src/features/notifications/email-templates.tsx`, de forma opcional para que las fixtures e intents previos sigan renderizando.
- [x] 2.2 Resolver el nombre desde la reserva en `src/features/notifications/template-data-source.ts` (mock) y en `src/infrastructure/database/notification-template-data-source.ts` (producción).
- [x] 2.3 Mostrar el saludo con el nombre en la confirmación al huésped y la línea de huésped en la alerta administrativa, en el renderer HTML y en la plantilla React equivalente.
- [x] 2.4 Verificar con tests que ambos correos contienen el nombre y que, sin nombre disponible, el correo se renderiza igual sin texto vacío ni "undefined".

## 3. Verificación

- [x] 3.1 Ejecutar `openspec validate --change limit-reservation-emails-to-website-bookings --strict`.
- [x] 3.2 Ejecutar la suite de tests y el build de producción. El test de integración PostgreSQL de datos de notificación queda pendiente de correr contra la base de prueba (requiere `POSTGRES_RESERVATION_INTEGRATION_ENABLED`).
