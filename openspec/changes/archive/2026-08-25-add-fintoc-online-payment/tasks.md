## 1. Configuración y entorno

- [x] 1.1 Agregar `FINTOC_API_KEY` y `FINTOC_WEBHOOK_SECRET` a `serverEnvironmentSchema` en `src/config/server.ts` y a `configurationValuesThatMayBeMocked`, y verificar que `getServerEnvironment()` falla sin ellos y pasa con valores mock en contexto `mock`
- [x] 1.2 Agregar las mismas variables (con valores mock) a `.env.example` y `.env.test.example`, siguiendo el patrón de `MERCADO_PAGO_*`

## 2. Migración de base de datos

- [x] 2.1 Crear migración Drizzle que agregue el valor `requires_action` al enum `payment_status` y verificar que `drizzle-kit` genera y aplica la migración sin error contra una base de datos local/test

## 3. Cliente de API de Fintoc

- [x] 3.1 Implementar un cliente HTTP server-only para `api.fintoc.com/v1` (creación de checkout session, creación de refund) autenticado con `FINTOC_API_KEY`, y verificar con un test unitario que arma correctamente el request de creación de checkout session (monto, moneda CLP, `success_url`/`cancel_url`)
- [x] 3.2 Implementar la verificación de firma de eventos de webhook usando `FINTOC_WEBHOOK_SECRET`, y verificar con un test que un payload con firma inválida es rechazado y uno válido es aceptado

## 4. Creación de pago en línea al confirmar reserva

- [x] 4.1 Agregar el endpoint/acción de backend que, al confirmar una reserva con modalidad `pay_now`, crea la checkout session en Fintoc y persiste `provider = "fintoc"` y `external_reference = checkout_session.id` en el registro de `payments` correspondiente, y verificar con un test de integración que la reserva queda con pago pendiente y la sesión creada
- [x] 4.2 Manejar el caso de error de Fintoc al crear la sesión (sin confirmar el pago, informando el error) y verificar con un test que la reserva no queda marcada como pagada

## 5. Webhook de confirmación

- [x] 5.1 Implementar el endpoint de webhook que recibe `checkout_session.finished`, `checkout_session.expired`, `payment_intent.succeeded`, `payment_intent.failed` y `payment_intent.requires_action`, verifica la firma, y actualiza el estado de pago de la reserva asociada; verificar con tests que cada evento produce la transición de estado esperada (nota: la revisión de la documentación de Fintoc mostró que `payment_intent.requires_action` no existe como tipo de evento en el enum autoritativo — es un valor de `status` dentro de eventos `payment_intent.*`/`checkout_session.*` — el parser se ajustó para leer `status` del objeto en vez del nombre del evento)
- [x] 5.2 Implementar idempotencia por `id` de evento (registrar eventos ya procesados) y verificar con un test que reenviar el mismo evento no duplica la actualización de estado
- [x] 5.3 Verificar con un test de integración que un evento `payment_intent.requires_action` deja el pago en estado transicional sin confirmar ni rechazar la reserva

## 6. Reembolsos

- [x] 6.1 Agregar la acción del panel administrativo para reembolsar (total o parcial) un pago aprobado hecho vía Fintoc, y verificar con un test que un reembolso total marca el pago como `refunded`
- [x] 6.2 Verificar con un test que un reembolso parcial no marca el pago como `refunded` y registra el monto reembolsado

## 7. Frontend: selección de modalidad de pago

- [x] 7.1 Agregar el selector de modalidad de pago (pago al llegar / pago en línea) en el flujo de confirmación de reserva, y verificar manualmente (o con test e2e) que elegir pago en línea redirige al `redirect_url` de Fintoc y elegir pago al llegar mantiene el comportamiento actual sin cambios (verificado con tests de componente; el pago en línea solo se ofrece para una habitación, por ser single-room en este change)

## 8. Documentación

- [x] 8.1 Actualizar `PRODUCT.md` para reflejar que el pago online ya no está fuera de alcance y que Fintoc es el primer proveedor habilitado, y verificar que no quedan referencias contradictorias al alcance anterior

## 9. Verificación end-to-end

- [x] 9.1 Probar el flujo completo (crear sesión → pagar en modo test de Fintoc → recibir webhook → reserva confirmada) usando las credenciales de test de Fintoc, y verificar que el estado final de la reserva y del pago es el esperado antes de habilitar modo `live`. Ejecutado contra la base de datos real (Supabase) y la API de test de Fintoc, con ngrok exponiendo el webhook. Encontró y corrigió 3 bugs reales:
  1. `initiateFintocCheckout` descartaba el error real en un `catch` vacío sin loguearlo.
  2. La detección de "evento de webhook ya procesado" (violación de unicidad Postgres) no funcionaba porque el driver de Postgres envuelve el `code` real en `error.cause`, no en `error` directamente.
  3. **Bug de idempotencia de mayor severidad**: el evento de webhook se marcaba como procesado *antes* de terminar de procesarlo; un fallo transitorio dejaba el evento marcado como "ya procesado" para siempre, perdiendo permanentemente los reintentos legítimos de Fintoc. Se agregó `discardWebhookEvent` para revertir el registro cuando el procesamiento falla.
  4. **Bug de integridad referencial**: al confirmar una reserva `pay_now`, `payments.hold_id` no se limpiaba antes de borrar el hold, violando la FK `payments_hold_id_reservation_holds_id_fk`. Corregido centralizando la limpieza en `deleteHold` (cubre tanto el camino de pago aprobado como el de pago rechazado/expirado).
  Confirmado en la base de datos real: reserva `confirmed`/`pay_now`, pago `approved` con `provider_payment_id` correcto y `hold_id` nulo tras liberarse el hold.
