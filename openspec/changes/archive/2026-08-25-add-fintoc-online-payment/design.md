## Context

El modelo de datos actual ya anticipa pago en línea: la tabla `payments` (`drizzle/0000_stale_masque.sql`) ya tiene `provider varchar(80)`, `provider_payment_id`, `external_reference`, y un enum `payment_mode` con valores `pay_now` y `pay_at_property`. El enum `payment_status` ya tiene `pending`, `approved`, `rejected`, `cancelled`, `refunded`. No existe hoy ningún estado transicional tipo "requiere acción" (ver [[fintoc-payment-integration]] y la capability `payment-processing`).

`src/config/server.ts` valida el entorno server-only con Zod y ya tiene el patrón para un proveedor de pago (`MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET`), incluido en `configurationValuesThatMayBeMocked` para permitir mocks en `mock` context. El MCP operativo de Fintoc (`https://mcp.fintoc.com`) está autenticado pero su servidor devuelve un error de protocolo en `tools/list` (falta `resultType` para la revisión `2026-07-28`), así que no se usa como capa de integración; se llama directamente la API REST de Fintoc (`https://api.fintoc.com/v1`).

## Goals / Non-Goals

**Goals:**
- Permitir pago en línea vía Fintoc Checkout Sessions como alternativa a pago al llegar, sin romper el flujo existente.
- Confirmar pagos exclusivamente vía webhook (nunca solo por el redirect del cliente), siguiendo la recomendación de Fintoc.
- Soportar reembolsos totales y parciales desde el panel administrativo.
- Mantener idempotencia ante reintentos/duplicados de webhook.

**Non-Goals:**
- Integrar Mercado Pago (queda para una iteración posterior, ya diseñada conceptualmente en `build-vista-valle-booking-mvp`).
- Usar el MCP operativo de Fintoc para llamadas en producción (solo se usa el MCP de documentación para consulta).
- Soportar `subscription` o `setup` flows de Fintoc; solo se usa el flow `payment` (pago único).
- Migrar pagos existentes de pago al llegar a pago en línea.

## Decisions

**Integración vía API REST directa, no vía MCP operativo de Fintoc**
El MCP `https://mcp.fintoc.com` está pensado para agentes de IA en tiempo de diseño/soporte, no como capa de runtime de una aplicación de producción; además hoy falla en `tools/list`. Se usa el cliente HTTP normal del backend contra `api.fintoc.com/v1`, autenticado con la API Secret Key en modo `live`.

**Reutilizar el modelo de datos existente de `payments` en vez de crear una tabla nueva**
La tabla ya tiene `provider`, `provider_payment_id`, `external_reference`, `mode` (`pay_now`/`pay_at_property`) y `status`. Se guarda `provider = "fintoc"`, `provider_payment_id = payment_intent.id` (una vez conocido) y `external_reference = checkout_session.id`. Alternativa descartada: tabla `fintoc_payments` separada — agrega un join innecesario cuando el modelo genérico ya cubre el caso multi-proveedor.

**Nuevo estado transicional "requiere acción" en `payment_status`**
Fintoc puede emitir `payment_intent.requires_action` para transferencias que necesitan aprobación de más de un representante en cuentas empresariales del pagador. Se agrega un valor al enum (`requires_action`) en vez de sobrecargar `pending`, para poder distinguir en el panel administrativo "todavía no se intentó pagar" de "el huésped ya inició el pago pero falta una aprobación externa".

**Verificación de firma del webhook obligatoria antes de procesar**
Se sigue la guía de webhooks de Fintoc: se valida la firma con el webhook secret configurado (`FINTOC_WEBHOOK_SECRET`) antes de leer el payload como confiable. Un evento con firma inválida se descarta y se responde con error, sin tocar ningún estado.

**Idempotencia por `id` de evento**
Se registra el `id` del evento de webhook procesado (reutilizando el patrón de outbox/eventos ya presente en el esquema, p. ej. la tabla de eventos vista en `drizzle/0000_stale_masque.sql`) para no aplicar el mismo evento dos veces ante reintentos de Fintoc.

**Selector de modalidad de pago en el flujo de confirmación**
El frontend agrega una opción explícita (pago al llegar / pago en línea) en el paso de confirmación de reserva; al elegir pago en línea, el backend crea la checkout session y redirige al huésped a `redirect_url` antes de marcar la reserva como confirmada-pendiente-de-pago.

## Risks / Trade-offs

- **[Riesgo] El huésped abandona el checkout de Fintoc sin pagar** → el evento `checkout_session.expired` deja el pago en estado pendiente/rechazado y la reserva no se confirma como pagada; se ofrece reintentar (ya cubierto por los escenarios de la spec).
- **[Riesgo] Reembolsos parciales dejan al pago en un estado ambiguo** → se registra el monto reembolsado acumulado y solo se marca `refunded` cuando el reembolso cubre el monto total pagado.
- **[Riesgo] Cambiar el enum `payment_status` en Postgres requiere una migración de tipo `ALTER TYPE ... ADD VALUE`** → se ejecuta como migración de Drizzle independiente antes de desplegar el código que la usa, siguiendo el mismo proceso ya usado en el proyecto para migraciones de esquema.
- **[Trade-off] No usar el MCP operativo de Fintoc en runtime** → se pierde la conveniencia de "un tool por operación", pero se evita depender de un servidor que hoy es incompatible con la revisión de protocolo del cliente MCP; se puede reevaluar cuando Fintoc corrija el problema (reportarlo a mcp@fintoc.com queda fuera de este change).

## Migration Plan

1. Migración de base de datos: agregar `requires_action` al enum `payment_status` (Drizzle).
2. Agregar variables de entorno `FINTOC_API_KEY` y `FINTOC_WEBHOOK_SECRET` (server-only) a `.env.example`, `.env.test.example`, y a `serverEnvironmentSchema` en `src/config/server.ts`, incluidas en `configurationValuesThatMayBeMocked`.
3. Implementar el cliente de API REST de Fintoc y el endpoint de creación de checkout session.
4. Implementar el endpoint de webhook con verificación de firma e idempotencia.
5. Implementar el flujo de reembolso desde el panel administrativo.
6. Agregar el selector de modalidad de pago en el frontend de confirmación de reserva.
7. Actualizar `PRODUCT.md` para reflejar que el pago online ya no está fuera de alcance.
8. Probar end-to-end en modo `test` de Fintoc antes de habilitar `live`.

Rollback: la modalidad `pay_at_property` sigue siendo el camino por defecto y no depende de Fintoc; si se detecta un problema, se puede ocultar el selector de pago en línea en el frontend sin afectar reservas existentes.
