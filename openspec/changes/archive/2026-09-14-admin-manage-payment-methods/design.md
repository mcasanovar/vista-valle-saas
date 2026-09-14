## Context

El patrón a replicar ya existe para `companyQuotationBreakfastCatalog`: tabla singleton en `src/persistence/schema.ts`, repositorio con `get()`/`update()` en `src/infrastructure/database/`, endpoint admin `GET`/`PUT` protegido con `requireAdministrator()`, y un componente client en `src/features/admin/` montado en `app/(admin-protected)/admin/configuracion/page.tsx`.

El flujo público hoy ya condiciona una parte de la UI de pago con un booleano server-side: `bookingEnabled` se resuelve en el servidor (`isBookingAcceptanceEnabled()`, leyendo una env var) y se pasa como prop hasta `BookingConfirmationController` a través de `app/pre-reserva/page.tsx` → `prebooking-review-controller.tsx`. El nuevo estado de métodos de pago debe resolverse server-side de la misma forma —no vía fetch al endpoint admin, que requiere sesión de administrador y no es accesible para un huésped anónimo.

Ver proposal.md - Why, para la motivación de negocio.

## Goals / Non-Goals

**Goals:**
- Que el estado habilitado/deshabilitado de cada método de pago se lea y actualice con el mismo patrón que `companyQuotationBreakfastCatalog`.
- Que la validación de método habilitado ocurra tanto en la UI pública como en los endpoints de confirmación de reserva (defensa en profundidad).

**Non-Goals:**
- No se rediseña el flujo de pago en sí (Fintoc checkout, webhook, reembolsos) ni el límite de `roomCount === 1` para pago online.
- No se agrega auditoría de quién cambió la configuración ni historial de cambios.
- No se ofrece un método de pago adicional ni se cambia el enum `paymentModeEnum` existente.

## Decisions

**Tabla singleton `payment_method_settings`** con columnas `pay_at_property_enabled boolean not null default true` y `pay_online_enabled boolean not null default true`, siguiendo exactamente la forma de `company_quotation_breakfast_catalog` (id, timestamps, "asegurar entrada por defecto en el primer acceso"). Alternativa descartada: dos filas en una tabla genérica `feature_flags` clave-valor — se descarta porque el proyecto no tiene ese patrón hoy y añadiría una abstracción nueva para dos booleanos con forma fija.

**Lectura pública server-side, no vía endpoint admin.** El endpoint `app/api/admin/payment-methods/route.ts` (`GET`/`PUT`) es solo para el dashboard admin y exige `requireAdministrator()`, igual que breakfast-catalog. El flujo público (`app/pre-reserva/page.tsx` y donde corresponda) llama directo al repositorio server-side (`getServerPaymentMethodSettingsRepository().get()`) sin pasar por HTTP, igual que hoy hace `isBookingAcceptanceEnabled()`. Esto evita exponer un endpoint público nuevo y reutiliza el mismo camino ya usado para `bookingEnabled`.

**Validación en servidor por reutilización del repositorio, no por HTTP interno.** Los endpoints `pay-at-property` y `fintoc-checkout` importan el mismo repositorio server-side y verifican el flag correspondiente antes de continuar, en el mismo punto donde ya llaman a `isBookingAcceptanceEnabled()`. Si el método solicitado está deshabilitado, responden con el mismo tipo de error 4xx que ya usan para `bookingEnabled=false`.

**Sin restricción de "al menos un método activo".** Por decisión explícita del negocio (ver proposal.md), guardar con ambos métodos deshabilitados es válido; el efecto esperado es que el huésped no vea ninguna opción de pago.

## Risks / Trade-offs

- [Un admin deshabilita ambos métodos sin darse cuenta y nadie puede reservar] → Es el comportamiento pedido explícitamente; se mitiga con el propio switch visible en `/admin/configuracion` mostrando el estado actual, sin necesidad de una alerta adicional en este change.
- [Un checkout de Fintoc ya iniciado antes de deshabilitar "pago online" sigue su curso] → No se cancela lo que ya está en vuelo; el webhook de Fintoc no se modifica en este change, así que un pago iniciado mientras el método estaba habilitado se procesa con normalidad si el proveedor confirma después.
- [Caché o revalidación] → La misma consideración que `companyQuotationBreakfastCatalog` (lectura directa a DB en cada solicitud server-side, sin caché); se sigue el mismo patrón, así que no se introduce un riesgo nuevo de staleness.

## Migration Plan

1. Migración de Drizzle que crea `payment_method_settings` (sin backfill de datos existentes; la fila por defecto se crea perezosamente en el primer `get()`, igual que breakfast catalog).
2. Deploy de repositorio + endpoint admin + UI admin — no cambia comportamiento público todavía (ambos métodos siguen apareciendo porque el default es "habilitado").
3. Deploy de los cambios en `BookingConfirmationController` y en los endpoints de confirmación que leen el flag — a partir de aquí el toggle admin tiene efecto real.
4. Rollback: revertir el deploy del paso 3 deja el comportamiento público como hoy (todo visible) aunque la tabla y la UI admin sigan existiendo; no requiere rollback de DB.
