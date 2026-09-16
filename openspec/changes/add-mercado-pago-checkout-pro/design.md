## Context

Ver `proposal.md` (Why) para la motivación de negocio. Este documento cubre el cómo.

Estado actual relevante:

- `reservation_holds` es single-room (`room_id`, `nightly_price_clp`, `guest_count`, `total_clp` viven en la misma fila). `reservations`/`reservation_items` ya son multi-room desde el MVP original; solo el hold quedó atrás porque Fintoc se construyó single-room.
- Todo el código de pago online (`src/features/payments/fintoc-*`) está acoplado directamente a Fintoc: no existe un punto de extensión para un segundo proveedor.
- Hay tres compuertas independientes que fuerzan una sola habitación en el pago en línea: la UI (`booking-confirmation-controller.tsx:48`), el endpoint (`fintoc-checkout-service.ts:54`), y la resolución de habitación (`fintoc-checkout-service.ts:32`), que además usa una lógica de resolución distinta (y con un bug) a la que usa pagar al llegar (`confirm-pay-at-property.ts`).
- Los holds son de vida muy corta (minutos, `BOOKING_HOLD_DURATION_MINUTES`) y el sitio es de bajo tráfico: no hay holds de larga duración que sobrevivan un deploy.
- `payments`/`payment_events` ya son agnósticos de proveedor (`provider` es `varchar(80)` libre, no enum).

## Goals / Non-Goals

**Goals:**
- Un solo modelo de retención multi-habitación, usado por cualquier proveedor de pago en línea (Mercado Pago hoy, Fintoc cuando se reactive).
- Un port de proveedor de pago online lo bastante delgado para que Fintoc migre detrás de él sin cambiar su comportamiento observable.
- Checkout Pro de Mercado Pago funcionando de punta a punta: preferencia, webhook, confirmación, contracargo.
- Unificar la resolución de habitaciones seleccionadas entre pagar al llegar y pagar en línea, eliminando la duplicación y el bug de decodificación.

**Non-Goals:**
- Reembolsos parciales o pagos agrupados por habitación: siempre es un pago único por el total (confirmado con el usuario).
- Reactivar Fintoc en producción (sigue detrás de su propio toggle, apagado por defecto).
- Cuotas o financiamiento: la preferencia de Mercado Pago se limita a 1 cuota.
- Cambiar el modelo de `reservations`/`reservation_items` (ya soportan N habitaciones; solo se toca el hold).

## Decisions

### 1. `reservation_holds` pasa a tener una tabla de ítems (`reservation_hold_items`)

Espejo exacto de la relación `reservations` → `reservation_items`:

```
reservation_holds                    reservation_hold_items
  ├── id                     1───N     ├── hold_id (FK, cascade)
  ├── guest_id                         ├── room_id (FK, restrict)
  ├── check_in / check_out             ├── guest_count
  ├── expires_at                       ├── nightly_price_clp
  └── total_clp  ← suma de items       ├── charges_clp
                                        └── subtotal_clp
```

Las columnas `room_id`, `nightly_price_clp`, `guest_count` se eliminan de `reservation_holds` (se mueven a la tabla de ítems); `total_clp`, `check_in`, `check_out`, `expires_at` quedan en el hold porque son compartidos por todas las habitaciones de esa retención.

`createHold` cambia de recibir un solo `roomId`/`pricing` a recibir un arreglo de ítems; internamente usa `RoomLockGateway.runLockedMany` (ya existe y ya ordena los ids para evitar deadlocks) en vez de `runLocked`.

**Alternativas consideradas:**
- *Mantener `room_id` en el hold y agregar una tabla de "habitaciones extra"*: rechazado, introduce una asimetría entre la primera habitación y el resto sin ninguna ventaja.
- *Un campo JSON con la lista de habitaciones*: rechazado, pierde las FK/constraints que ya protegen `reservation_items` y sería inconsistente con el resto del esquema.

### 2. Port `OnlinePaymentProvider` para desacoplar Fintoc y Mercado Pago del núcleo

```
type OnlinePaymentProvider = Readonly<{
  createCheckoutSession: (input: CreateCheckoutSessionInput) => Promise<{ providerRef: string; redirectUrl: string }>;
  parseAndVerifyWebhookEvent: (raw: RawWebhookRequest) => Promise<NormalizedPaymentEvent | null>;
}>;
```

- `NormalizedPaymentEvent` es la forma que hoy produce `parseFintocWebhookEvent` (id, tipo, estado del payment intent, referencia externa) — ya es agnóstica, el núcleo (`processFintocWebhookEvent` → renombrado `processOnlinePaymentWebhookEvent`) no cambia su lógica de idempotencia/hold-vencido/confirmación.
- `parseAndVerifyWebhookEvent` es `async` porque el adaptador de Mercado Pago necesita hacer `GET /v1/payments/{id}` después de verificar la firma (ver decisión 4); el de Fintoc simplemente no hace ninguna llamada adicional.
- Fintoc se re-empaqueta como adaptador (`fintoc-provider.ts` implementando el port) sin tocar `fintoc-client.ts`, `fintoc-webhook-signature.ts` ni `fintoc-webhook-parser.ts` por dentro — solo el punto donde hoy la ruta llama directo a esas funciones pasa a llamarlas a través del port.
- No se crea abstracción para reembolsos: no es un requisito de este change (`applyRefund` de Fintoc queda como está, sin generalizar, porque Mercado Pago no la necesita).

**Alternativa considerada:** duplicar el árbol de archivos de Fintoc para Mercado Pago sin extraer un port. Rechazada: dejaría la lógica de idempotencia y transición de estados (hoy ya correcta y probada) duplicada en dos lugares que divergirían con el tiempo, y Fintoc no heredaría el soporte multi-habitación de la decisión 1.

### 3. Resolución de habitaciones unificada

`initiatePublicFintocCheckout`/su equivalente para Mercado Pago dejan de tener su propia función `selectedRoom` y pasan a usar `selectedRooms` + `toReservationRoom` (las mismas que usa `confirm-pay-at-property.ts`), que ya decodifican correctamente el parámetro `rooms` con ocupación (`doble:2,matrimonial:1`) y aplican el precio por ocupación. Esto corrige el bug latente donde el checkout online no decodificaba el sufijo `:guestCount` y también aplica el precio correcto por ocupación, que hoy el camino online no aplicaba.

### 4. Verificación y estado del webhook de Mercado Pago

Mercado Pago notifica `{ type: "payment", data: { id } }` sin estado. El adaptador:

1. Verifica `x-signature` contra el manifest `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` con HMAC-SHA256 y `MERCADO_PAGO_WEBHOOK_SECRET` (algoritmo documentado por Mercado Pago, distinto al de Fintoc que firma el body crudo).
2. Si la firma es válida, consulta `GET /v1/payments/{id}` con `MERCADO_PAGO_ACCESS_TOKEN` para obtener el estado real (`approved`, `rejected`, `cancelled`, `pending`, `authorized`, `in_process`, `charged_back`).
3. Traduce ese estado a los valores ya existentes en `payment_status` (`authorized`/`in_process` → `requires_action`) y al nuevo `charged_back`.

Un fallo transitorio en el paso 2 (5xx/red) debe responder con error HTTP al webhook, para que Mercado Pago reintente — igual que hoy hace Fintoc con sus propios 5xx.

**Alternativa considerada:** confiar en el campo `action`/`type` del payload sin consultar la API. Rechazada explícitamente por la propia documentación de Mercado Pago: la notificación no es autoritativa por sí sola.

### 5. Deduplicación de eventos de Mercado Pago

`payment_events_provider_event_unique` es hoy `(provider, provider_event_id)`. Mercado Pago no garantiza un id de notificación estable entre reintentos, así que la clave de idempotencia para el adaptador de Mercado Pago es `(payment.id, status)` obtenido en el paso 2 de la decisión 4 (se guarda como `provider_event_id` sintético, ej. `"{paymentId}:{status}"`), no el id de la notificación entrante. Esto reutiliza la misma tabla y el mismo mecanismo `recordWebhookEvent`/`discardWebhookEvent` sin cambios de esquema.

### 6. Vencimiento de la preferencia atado al hold

`date_of_expiration` de la preferencia se fija igual a `hold.expiresAt`. Si el huésped completa el pago después de ese instante, Mercado Pago rechaza el intento en su propio checkout antes de notificar — evita el caso donde el hold ya liberó la habitación pero el proveedor todavía intenta cobrar.

### 7. Tercer toggle en `payment_method_settings`

Se agrega `pay_by_card_enabled boolean not null default true` (nombre por lo que el método es — tarjeta — no por el proveedor, igual que `payAtPropertyEnabled`/`payOnlineEnabled` no llevan el nombre de Fintoc). `payOnlineEnabled` conserva su nombre y pasa a representar específicamente "transferencia bancaria (Fintoc)" en la UI, sin cambiar la columna.

### 8. Migración de esquema y despliegue

Los holds viven minutos (no hay holds de larga duración en vuelo). Se migra `reservation_holds`/`reservation_hold_items` y se despliega el código nuevo en el mismo release, sin columnas de transición ni feature flag: el riesgo de una fila creada por el código viejo y leída por el código nuevo (o viceversa) durante la ventana de corte del deploy es despreciable dado el TTL corto y el tráfico del sitio.

## Risks / Trade-offs

- [El adaptador de Mercado Pago depende de una llamada HTTP saliente dentro del webhook, a diferencia de Fintoc que es puro] → Mitigación: timeout explícito + responder 5xx en fallo transitorio para que Mercado Pago reintente; no hay alternativa, es como Mercado Pago diseñó su webhook.
- [Un contracargo llega potencialmente días o semanas después de que el huésped ya se alojó] → Mitigación explícita del usuario: solo alertar al admin, sin automatizar ninguna reversión de reserva o disponibilidad.
- [`reservation_hold_items` introduce una segunda tabla de ítems muy similar a `reservation_items`, cierta duplicación estructural] → Aceptado: es el mismo patrón que ya usa el proyecto para separar "temporal" (`hold`) de "definitivo" (`reservation`); no se comparte la tabla porque sus ciclos de vida y FKs de borrado son distintos (`cascade` en el hold vencido vs. `restrict` en la reserva confirmada).
- [Migración de esquema sin columnas de compatibilidad] → Mitigación: coordinar el deploy fuera de un pico de tráfico (bajo de por sí en este sitio) y verificar que no haya holds activos antes de aplicar la migración, igual que se hace hoy para otras migraciones del proyecto.

## Open Questions

Ninguna: las decisiones de negocio pendientes (multi-habitación, cuotas, liquidación, contracargo) ya fueron resueltas con el usuario antes de este documento.
