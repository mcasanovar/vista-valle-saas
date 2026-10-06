## Why

Las notificaciones de cotización (correo al cliente y alerta a `ADMIN_NOTIFICATION_EMAIL`) dependen hoy de un worker externo (Lambda + EventBridge en AWS, fuera de este repositorio y sin infraestructura auditable) para procesar el outbox en producción. Si ese disparador externo falla o queda desincronizado, el correo nunca sale y la app de Next.js no registra ningún error, porque desde su perspectiva nadie la invocó. Esto ya ocurrió: una cotización se guardó correctamente pero su alerta administrativa nunca llegó.

## What Changes

- El endpoint `POST /api/company-quotations` SHALL intentar la entrega de las notificaciones de esa cotización (correo al cliente y alerta admin) justo después de responder al cliente, en la misma invocación serverless, usando `after()` de `next/server` — sin depender del worker externo como primer intento.
- `writeCompanyQuotationRequested` (o el creation service que la envuelve) SHALL devolver los IDs de los intents de outbox recién encolados, para poder procesarlos de forma dirigida en vez de barrer todo el backlog global del outbox en cada request.
- Se expone una función de proceso dirigido por ID (`processOutboxIntentById` o equivalente) a partir del `DeliveryProcessor` interno ya existente en `scheduled-processor.ts`.
- El worker externo (Lambda/EventBridge, o su reemplazo por un cron nativo de Vercel) se conserva como red de respaldo para reintentar los intents que el intento inmediato vía `after()` no logre completar (p. ej. por reciclado de la instancia serverless) — no se elimina el mecanismo de reintentos, solo deja de ser el único disparador.
- Se define `maxDuration` explícito en `app/api/company-quotations/route.ts` para dar margen al intento de entrega dentro de `after()`.

## Capabilities

### New Capabilities

(ninguna)

### Modified Capabilities

- `transactional-notifications`: agrega el requisito de que el sistema intente la entrega inmediatamente tras persistir la intención de notificar (best-effort, en la misma request), en vez de depender exclusivamente de un procesador programado externo como único disparador.

## Impact

- `app/api/company-quotations/route.ts`: agrega `after()` tras crear la cotización; agrega `maxDuration`.
- `src/infrastructure/database/company-quotation-repository.ts`: `createDrizzleCompanyQuotationCreationService` debe devolver los IDs de los intents de outbox encolados.
- `src/features/notifications/outbox.ts` y `src/infrastructure/database/notification-outbox-repository.ts`: `writeCompanyQuotationRequested` debe devolver los IDs insertados.
- `src/features/notifications/scheduled-processor.ts` y `src/infrastructure/database/notification-processor-source.ts`: exponer una función de proceso dirigido por ID, reutilizando el `DeliveryProcessor` ya existente.
- No afecta el endpoint `app/api/internal/outbox/process/route.ts` ni el worker externo, que siguen existiendo como respaldo de reintentos.
