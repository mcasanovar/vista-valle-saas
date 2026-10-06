## Context

Ver `proposal.md` - Why. El outbox de notificaciones (`notification_outbox`, Postgres) y su escritura transaccional ya existen y no cambian. Hoy en producción el único disparador del procesador es un endpoint interno (`app/api/internal/outbox/process/route.ts`) protegido por `OUTBOX_PROCESSOR_SECRET`, invocado por infraestructura AWS (Lambda + EventBridge) externa a este repositorio. El modo `mock` ya invoca el procesador de forma síncrona y bloqueante dentro de `app/api/company-quotations/route.ts` (líneas 81-83) justo antes de responder — ese es el único precedente de invocación síncrona en el código, y es la base conceptual de este diseño, adaptado a producción y a no bloquear la respuesta.

El proyecto corre Next.js 16.3.1 (App Router, runtime `nodejs` en las rutas afectadas), donde `after()` de `next/server` es una API estable sin dependencias adicionales. No hay paquete `@vercel/functions` instalado ni se necesita.

## Goals / Non-Goals

**Goals:**
- Que el primer intento de entrega de las notificaciones de una cotización ocurra sin depender de que un sistema externo (Lambda/EventBridge) invoque el endpoint interno.
- Que ese intento sea dirigido (solo los intents de esa solicitud), no un barrido del backlog completo de outbox en cada request.
- Que ese intento no añada latencia perceptible a la respuesta que recibe el cliente del formulario.
- Conservar el mecanismo de reintentos existente (vía el procesador programado) como respaldo cuando el intento inmediato no complete.

**Non-Goals:**
- No se decide en este cambio si el worker externo (Lambda/EventBridge) se reemplaza por un cron nativo de Vercel; se mantiene como está, sirviendo ahora como respaldo de reintentos en vez de único disparador. Esa migración, si se hace, es un cambio separado.
- No se extiende este patrón a los demás flujos que usan el outbox (reservas, pagos vía MercadoPago) en este cambio; se limita a `POST /api/company-quotations`. Extenderlo es un cambio futuro una vez validado aquí.
- No se modifica el contenido ni las plantillas de los correos, solo el momento y el disparador del primer intento de entrega.

## Decisions

### 1. `after()` nativo de `next/server`, no `waitUntil` de `@vercel/functions`
Next 16.3.1 ya soporta `after()` de forma estable en runtime `nodejs`, que es el que usan las rutas afectadas. Agregar `@vercel/functions` solo para `waitUntil` introduciría una dependencia nueva sin beneficio adicional, porque `after()` cubre el mismo caso de uso (ejecutar código tras enviar la respuesta HTTP, dentro de la misma invocación serverless).

### 2. Entrega dirigida por ID, no `scheduledOutboxProcessor.run()` genérico
`run()` barre hasta 20 items de todo el backlog global del outbox (de cualquier flujo: reservas, pagos, otras cotizaciones concurrentes). Invocarlo dentro de `after()` en cada request de cotización haría que cada solicitud pague el costo de procesar trabajo ajeno, y podría generar contención entre requests concurrentes. En cambio:
- `writeCompanyQuotationRequested` pasa a devolver los IDs de los intents insertados (`company_quotation_customer`, `company_quotation_admin`).
- Se expone una función de proceso dirigido (p. ej. `processOutboxIntentsByIds(ids)`) a partir del `DeliveryProcessor.process(outboxId)` interno que ya existe en `scheduled-processor.ts`, reutilizando toda su lógica de rendering, entrega vía Resend, y registro de éxito/fallo — sin duplicar esa lógica.
- `route.ts` llama `after(() => processOutboxIntentsByIds([...]))` con los IDs de su propia solicitud, no con el backlog global.

Alternativa considerada: aceptar el costo de `run()` genérico por ser cero-cambios en `creationService`. Se descarta porque el costo por request escala con el backlog total, no con el trabajo real de esa request, y porque dos requests concurrentes podrían competir por los mismos items pendientes de otros flujos de forma redundante.

### 3. El worker externo (o su reemplazo) se mantiene como respaldo, no se elimina
`after()` no garantiza completarse si la instancia serverless se recicla a mitad de camino (limitación documentada de la plataforma). El intento inmediato se trata como best-effort; el procesador programado sigue siendo la garantía de que todo intent pendiente eventualmente se reintenta. Esto preserva el requisito ya existente de "Entrega desacoplada" en `transactional-notifications` sin regresión.

### 4bis. Fallback cuando `after()` se invoca fuera de un request scope de Next
`after()` lanza un error síncrono (`` `after` was called outside a request scope ``) si se invoca sin que Next haya establecido su contexto interno de request — que es exactamente lo que ocurre cuando los tests de este proyecto invocan el `POST` exportado de `route.ts` directamente, sin pasar por el router de Next (patrón ya usado en `tests/company-quotation-route.test.ts`). En un despliegue real, el router de Next siempre establece ese contexto antes de llamar al handler, así que esto nunca ocurre en producción. Se envuelve la llamada a `after()` en un helper que, si lanza ese error puntual, cae a invocar la tarea sin bloquear (fire-and-forget) en su lugar — preservando el comportamiento real en producción y manteniendo testeable el handler sin reescribir la suite existente.

### 4. `maxDuration` explícito en `app/api/company-quotations/route.ts`
Hoy la ruta no declara `maxDuration` y corre con el default bajo de la plataforma. Como el trabajo de `after()` consume tiempo de cómputo de la misma invocación (aunque después de responder al cliente), se fija un valor explícito con margen suficiente para una llamada a Resend más su reintento interno de red, evitando que la instancia se corte a mitad del intento inmediato.

## Risks / Trade-offs

- [`after()` puede no completarse si Vercel recicla la instancia antes de terminar] → Mitigación: se trata como best-effort; el procesador programado (worker externo o su reemplazo futuro) sigue reintentando cualquier intent que no quede `delivered`.
- [Llamar a Resend dentro de `after()` sigue consumiendo cómputo/costo de la función, aunque no bloquee la respuesta al cliente] → Mitigación: el procesamiento es dirigido (2 intents, no el backlog), acotando el costo por request a un tamaño conocido y pequeño.
- [Doble intento de entrega: el `after()` inmediato y, más tarde, el worker externo, podrían competir sobre el mismo intent] → Mitigación: se reutiliza el mismo `DeliveryProcessor` y el mismo registro de estado de entrega (`delivered`/`failed`/`retrying`) que ya previene duplicados hoy entre ejecuciones del procesador programado; ningún cambio de este diseño toca esa garantía de idempotencia.

## Migration Plan

1. Modificar `writeCompanyQuotationRequested` (mock y Drizzle) para devolver los IDs de los intents insertados.
2. Propagar esos IDs desde `creationService.create()` hasta `route.ts`.
3. Exponer `processOutboxIntentsByIds` en `notification-processor-source.ts`, envolviendo el `DeliveryProcessor` existente.
4. Agregar la llamada `after(() => processOutboxIntentsByIds(ids))` en `route.ts`, reemplazando la rama actual que solo corre en modo `mock` (esa rama pasa a ser el comportamiento normal, ya no condicionado a `VISTA_VALLE_CONFIG_CONTEXT === "mock"`).
5. Definir `maxDuration` en `route.ts`.
6. Desplegar y validar con una cotización de prueba que el correo admin llega sin que el worker externo intervenga (se puede simular deshabilitando temporalmente el endpoint interno o revisando que el intent quede `delivered` antes de que el worker externo tenga oportunidad de correr).
7. Rollback: si `after()` presenta problemas en producción, revertir el commit deja intacto el camino existente (worker externo) sin pérdida de datos, porque el outbox y su contenido no cambian.

## Open Questions

(ninguna - todas las decisiones de alcance quedaron resueltas arriba; la eventual migración del worker externo a un cron nativo de Vercel queda fuera de alcance, no pendiente de decidir aquí)
