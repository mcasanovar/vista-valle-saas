## 1. Retención multi-habitación (núcleo, agnóstico de proveedor)

- [x] 1.1 Crear la migración Drizzle para `reservation_hold_items` (`hold_id` FK cascade, `room_id` FK restrict, `guest_count`, `nightly_price_clp`, `charges_clp`, `subtotal_clp`, unique `(hold_id, room_id)`) y eliminar `room_id`/`nightly_price_clp`/`guest_count` de `reservation_holds`, verificando que `drizzle-kit generate` produzca la migración esperada sin cambios manuales
- [x] 1.2 Actualizar `HoldRepository.createHold` (mock y Drizzle) para recibir un arreglo de ítems y usar `RoomLockGateway.runLockedMany` en vez de `runLocked`, verificando con un test que un hold de 2+ habitaciones bloquea todas atómicamente y que un conflicto en cualquiera de ellas revierte la creación completa
- [x] 1.3 Actualizar `ReservationHoldRecord`/`CreateHoldInput` y todo el código que los consume (`createPaymentHold`, `confirm-pay-now-reservation.ts`, `fintoc-checkout-status.ts`) para trabajar con la lista de ítems en vez de un `roomId` único, verificando que el build de TypeScript pasa sin `any`
- [x] 1.4 Actualizar `confirmPayNowReservationFromHold` para crear un `ReservationRecord` con un `reservation_items` por cada ítem del hold (reusando el mismo total ya calculado, sin recalcular precio), verificando con un test que una reserva confirmada desde un hold de N habitaciones queda con N ítems y un único pago por el total
- [x] 1.5 Actualizar `releaseFailedPayNowHold` para liberar la ocupación de todas las habitaciones del hold en conjunto, verificando con un test que un pago rechazado en un hold de N habitaciones libera las N sin dejar ninguna ocupada parcialmente
- [x] 1.6 Unificar la resolución de habitaciones seleccionadas: reemplazar la función `selectedRoom` de `fintoc-checkout-service.ts` por `selectedRooms`/`toReservationRoom` (las mismas de `confirm-pay-at-property.ts`), verificando con un test que `rooms=doble:2,matrimonial:1` resuelve las dos habitaciones con su ocupación y precio correctos, igual que en pagar al llegar
- [x] 1.7 Eliminar la compuerta de una sola habitación en `booking-confirmation-controller.tsx:48` y en el endpoint de checkout online, verificando manualmente en el navegador que con 2 habitaciones en el carrito la opción de pago en línea sigue visible y funcional

## 2. Port `OnlinePaymentProvider` y adaptador Fintoc

- [x] 2.1 Definir el tipo `OnlinePaymentProvider` (`createCheckoutSession`, `parseAndVerifyWebhookEvent`) y el tipo `NormalizedPaymentEvent` compartido, verificando que compila sin referencias a Fintoc ni a Mercado Pago en las firmas
- [x] 2.2 Envolver `fintoc-client.ts`/`fintoc-webhook-signature.ts`/`fintoc-webhook-parser.ts` existentes en un adaptador `fintoc-provider.ts` que implemente `OnlinePaymentProvider`, sin cambiar su comportamiento, verificando que la suite de tests de Fintoc existente (`fintoc-*.test.ts`) sigue pasando sin modificaciones
- [x] 2.3 Renombrar `processFintocWebhookEvent` a `processOnlinePaymentWebhookEvent` (parámetro de proveedor inyectado, mismo comportamiento) y actualizar la ruta `/api/webhooks/fintoc` para usar el adaptador Fintoc a través del port, verificando que los tests de webhook de Fintoc siguen pasando

## 3. Adaptador Mercado Pago

- [x] 3.1 Implementar `mercado-pago-client.ts`: crear preferencia Checkout Pro (1 cuota máximo, `back_urls`/`auto_return`, `date_of_expiration` = `expiresAt` del hold, `external_reference` = id del hold), verificando con un test contra un cliente mock que el payload enviado tiene los campos correctos
- [x] 3.2 Implementar `mercado-pago-webhook-signature.ts`: construir el manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` y verificar el HMAC-SHA256 contra `x-signature` con `MERCADO_PAGO_WEBHOOK_SECRET`, verificando con tests que una firma válida pasa y una alterada se rechaza
- [x] 3.3 Implementar la consulta `GET /v1/payments/{id}` y el mapeo de estados de Mercado Pago (`approved`, `rejected`, `cancelled`, `pending`, `authorized`, `in_process`, `charged_back`) a `payment_status` (incluyendo el nuevo valor `charged_back`), verificando con tests unitarios cada transición de estado
- [x] 3.4 Implementar `mercado-pago-provider.ts` (adaptador que implementa `OnlinePaymentProvider`, componiendo 3.1–3.3) y `app/api/webhooks/mercadopago/route.ts`, verificando manualmente con una notificación de prueba (usuario de prueba del MCP de Mercado Pago) que el flujo completo confirma una reserva
- [x] 3.5 Agregar el valor `charged_back` al enum `payment_status` (migración Drizzle) y la lógica de alerta administrativa (reusando el canal de `hold-expiry-alert.ts`) cuando un pago aprobado recibe un contracargo, sin revertir la reserva ni la disponibilidad, verificando con un test que la reserva permanece confirmada tras el contracargo
- [x] 3.6 Implementar la deduplicación de eventos de Mercado Pago usando la clave sintética `(paymentId, status)` sobre `payment_events`, verificando con un test que una notificación reenviada con el mismo `paymentId`/estado no vuelve a ejecutar la confirmación

## 4. Configuración de métodos de pago (admin)

- [x] 4.1 Agregar la columna `pay_by_card_enabled` (default `true`) a `payment_method_settings` (migración Drizzle) y el campo correspondiente en `PaymentMethodSettings`/`normalizePaymentMethodSettingsInput`, verificando que la lectura pública siempre entrega los tres campos
- [x] 4.2 Actualizar el formulario admin de métodos de pago para mostrar y editar el tercer toggle ("Tarjeta de crédito o débito"), verificando manualmente que deshabilitar/habilitar cada método persiste independientemente de los otros dos
- [x] 4.3 Actualizar `booking-confirmation-controller.tsx` para ofrecer hasta tres opciones (pagar al llegar, transferencia bancaria, tarjeta) según los toggles, permitiendo elegir entre online cuando más de uno esté habilitado, verificando manualmente cada combinación de toggles en el navegador
- [x] 4.4 Renombrar las etiquetas visibles al huésped y al admin: "Pagar al llegar", "Transferencia bancaria" (antes "Pagar online"/Fintoc), "Tarjeta de crédito o débito" (Mercado Pago), incluyendo la pantalla de detalle de reserva admin (`app/(admin-protected)/admin/reservas/[id]/page.tsx:261`), verificando visualmente los tres casos

## 5. Variables de entorno y despliegue

- [x] 5.1 Confirmar que `MERCADO_PAGO_ACCESS_TOKEN`/`MERCADO_PAGO_WEBHOOK_SECRET` ya declaradas en `src/config/server.ts` reciben las credenciales reales (usar `get_credentials`/`create_application` del MCP de Mercado Pago) y cargarlas en Vercel (proyecto `vista-valle`, producción)
- [x] 5.2 Registrar la URL del webhook de producción (`https://vistavallehospedaje.com/api/webhooks/mercadopago`) en el panel de Mercado Pago y confirmar el secreto configurado coincide con `MERCADO_PAGO_WEBHOOK_SECRET`
- [ ] 5.3 Verificar en el panel de Mercado Pago que la liquidación de fondos está configurada a plazo (no inmediata), según lo decidido con el usuario
- [ ] 5.4 Ejecutar el checklist de calidad del MCP de Mercado Pago (`quality_checklist`/`quality_evaluation`) contra la integración antes de solicitar la homologación (`form_homologation`)

## 6. Pruebas end-to-end y cierre

- [x] 6.1 Agregar pruebas de integración PostgreSQL para el hold multi-habitación (creación, confirmación, liberación) igual de cubiertas que las existentes de Fintoc single-room
- [x] 6.2 Agregar pruebas end-to-end (Playwright, contexto mock) del flujo de pago con tarjeta para 1 y para 2+ habitaciones
- [ ] 6.3 Probar en producción con un pago real de tarjeta (usuario de prueba de Mercado Pago primero, luego un pago real menor) de 1 habitación y de 2+ habitaciones, verificando redirección a confirmación, reserva con pago aprobado, y correo de confirmación enviado
- [ ] 6.4 Verificar manualmente el caso de abandono (cerrar el checkout de Mercado Pago sin pagar) y el de vencimiento del hold antes de completar el pago, confirmando que la habitación se libera y la reserva no queda pagada
