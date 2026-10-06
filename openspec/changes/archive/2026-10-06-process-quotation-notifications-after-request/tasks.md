## 1. Outbox: devolver IDs de intents encolados

- [x] 1.1 Modificar `writeCompanyQuotationRequested` en `src/features/notifications/outbox.ts` (implementación mock) para que devuelva los IDs de los intents `company_quotation_customer` y `company_quotation_admin` recién insertados, y verificar con un test unitario que el valor de retorno contiene ambos IDs.
- [x] 1.2 Modificar `writeCompanyQuotationRequested` en `src/infrastructure/database/notification-outbox-repository.ts` (implementación Drizzle/Postgres) para devolver los mismos IDs desde el `INSERT`, y verificar con un test de integración contra la base de prueba que los IDs devueltos corresponden a filas reales en `notification_outbox`.
- [x] 1.3 Propagar esos IDs a través de `createDrizzleCompanyQuotationCreationService` (`src/infrastructure/database/company-quotation-repository.ts`) y de la implementación mock equivalente, de modo que `creationService.create()` devuelva (junto al `record` de la cotización) los IDs de los intents encolados, y verificar que los tests existentes de creación de cotización siguen pasando con el nuevo valor de retorno.

## 2. Procesador dirigido por ID

- [x] 2.1 Exponer una función `processOutboxIntentsByIds(ids: string[])` en `src/infrastructure/database/notification-processor-source.ts`, reutilizando el `DeliveryProcessor.process(outboxId)` interno ya existente en `scheduled-processor.ts`, y verificar con un test unitario que procesa únicamente los IDs recibidos sin leer `listReady()` del backlog global.
- [x] 2.2 Verificar mediante test que, si uno de los IDs no existe o ya fue entregado, la función no falla para los demás IDs del lote (tolerancia por ítem).

## 3. Disparo en la ruta de cotizaciones

- [x] 3.1 En `app/api/company-quotations/route.ts`, tras `creationService.create(...)`, envolver la llamada a `processOutboxIntentsByIds(ids)` en `after()` de `next/server`, reemplazando la rama actual que solo ejecutaba `getScheduledOutboxProcessor()?.run()` en modo `mock`, y verificar con un test de integración (o e2e del endpoint) que la respuesta HTTP se devuelve sin esperar el resultado de la entrega.
- [x] 3.2 Añadir `export const maxDuration = <valor>;` en `app/api/company-quotations/route.ts` con margen suficiente para una llamada a Resend más reintento interno de red, y verificar que el valor elegido está documentado en un comentario breve justificando el número.
- [x] 3.3 Verificar manualmente (ambiente mock local) que tras un POST exitoso a `/api/company-quotations`, ambos intents (`company_quotation_customer`, `company_quotation_admin`) quedan en estado `delivered` sin invocar `app/api/internal/outbox/process`.

## 4. Verificación de no regresión del respaldo externo

- [x] 4.1 Confirmar (lectura de código + test existente) que `app/api/internal/outbox/process/route.ts` sigue funcionando sin cambios como respaldo de reintentos, y que el worker externo (Lambda/EventBridge) no requiere ninguna modificación para seguir reintentando intents que el `after()` no haya completado.
- [x] 4.2 Añadir o ajustar un test que simule un intento inmediato fallido (p. ej. `processOutboxIntentsByIds` lanza o el intent queda `retrying`) y verificar que una llamada posterior al procesador programado (`run()` o el endpoint interno) sí logra entregarlo, confirmando ausencia de duplicados.

## 5. Validación de especificación

- [x] 5.1 Ejecutar `openspec validate --change process-quotation-notifications-after-request --strict` y verificar que no reporta errores.
- [x] 5.2 Generar una cotización de prueba de extremo a extremo (según lo planteado en design.md - Migration Plan, paso 6) y verificar que el correo admin llega sin que el worker externo haya tenido oportunidad de correr.
