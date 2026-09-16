## Why

Fintoc Checkout sigue construido pero apagado por costos y seguirá así por ahora (`activate-fintoc-production` queda en pausa). Necesitamos un medio de pago online real para que los huéspedes puedan pagar con tarjeta de crédito o débito, usando Mercado Pago Checkout Pro como proveedor. Además, el pago en línea existente (Fintoc) nunca soportó reservas de más de una habitación — una restricción deliberada en su momento que ya no es aceptable: el pago online debe funcionar igual que pagar al llegar, sin importar cuántas habitaciones lleve la reserva.

## What Changes

- Agregar Mercado Pago Checkout Pro como un tercer método de pago, con su propio toggle independiente en el dashboard admin (`payAtPropertyEnabled`, `payOnlineEnabled` para Fintoc, y uno nuevo para Mercado Pago), igual que los otros dos.
- Sin cuotas: la preferencia de pago se crea con un máximo de 1 cuota.
- Extraer un port `OnlinePaymentProvider` del código hoy acoplado a Fintoc, para que el núcleo de pago (creación de hold, confirmación, liberación) sea agnóstico de proveedor. Fintoc pasa a ser un adaptador detrás de ese port, sin cambiar su comportamiento actual.
- Eliminar la restricción de una sola habitación en el pago en línea: la retención (`reservation_holds`) pasa a soportar N habitaciones (tabla `reservation_hold_items`, análoga a `reservation_items`), y las tres compuertas que hoy fuerzan "una habitación" (UI, endpoint de checkout, resolución de habitación) se eliminan. Esto beneficia a cualquier proveedor de pago en línea, incluyendo Fintoc cuando se reactive.
- Unificar la resolución de habitaciones seleccionadas entre el flujo de pago al llegar y el de pago en línea (hoy son dos implementaciones distintas; la del pago en línea no decodifica correctamente el parámetro `rooms` cuando incluye ocupación, ej. `doble:2`).
- Webhook de Mercado Pago: verificar la firma según el manifest HMAC-SHA256 de Mercado Pago (no el body crudo como Fintoc) y, dado que la notificación no trae el estado del pago, consultar `GET /v1/payments/{id}` para obtenerlo.
- Contracargo (`charged_back`): nuevo estado de pago. Cuando Mercado Pago reporta un contracargo sobre un pago ya aprobado, el sistema marca el pago y genera una alerta administrativa, sin revertir la reserva ni la disponibilidad automáticamente.
- Vencimiento de la preferencia de pago (`date_of_expiration`) atado al TTL del hold, para que el link de pago muera cuando expira la retención.
- Renombrar las etiquetas visibles al huésped por lo que cada método realmente es: "Pagar al llegar", "Tarjeta de crédito o débito" (Mercado Pago), "Transferencia bancaria" (Fintoc) — ya no tiene sentido un genérico "Pagar online" con dos proveedores distintos.
- No hay reembolsos parciales ni pagos agrupados: independiente de cuántas habitaciones lleve la reserva, siempre es un único pago por el total.

## Capabilities

### New Capabilities
- `mercado-pago-payment-integration`: creación de preferencias Checkout Pro, verificación y procesamiento del webhook, resolución del estado real del pago, manejo de contracargos.

### Modified Capabilities
- `payment-processing`: el pago en línea deja de estar restringido a una habitación (ahora soporta N habitaciones con un único pago por el total, igual que pago al llegar) y pasa a admitir más de un proveedor de pago en línea (Mercado Pago además de Fintoc).
- `admin-payment-method-settings`: se agrega un tercer método de pago independiente ("pagar con tarjeta" vía Mercado Pago) a la entrada de configuración y a la pantalla admin, con las mismas reglas de habilitación/deshabilitación que los otros dos.

## Impact

- Base de datos: nueva tabla `reservation_hold_items`; nueva columna en `payment_method_settings`; nuevo valor `charged_back` en el enum `payment_status`.
- Código: `src/features/payments/*` (nuevo port `online-payment-provider`, nuevo adaptador `mercado-pago-*`, Fintoc migrado detrás del port sin cambiar su comportamiento), `src/features/reservations/hold-repository.ts`, `confirm-pay-now-reservation.ts`, `reservation-repository.ts`, `booking-confirmation-controller.tsx`, rutas `app/api/bookings/*` y un nuevo webhook `app/api/webhooks/mercadopago`.
- Variables de entorno de producción (Vercel, proyecto `vista-valle`): `MERCADO_PAGO_ACCESS_TOKEN` y `MERCADO_PAGO_WEBHOOK_SECRET` (ya declaradas en `src/config/server.ts`, pendientes de credenciales reales).
- Dashboard admin: nuevo toggle de método de pago y actualización de etiquetas.
- Ningún cambio de comportamiento en Fintoc; sigue apagado (`payOnlineEnabled = false` por defecto para ese método) hasta que se decida reactivarlo.
