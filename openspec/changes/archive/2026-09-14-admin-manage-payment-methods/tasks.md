## 1. Base de datos

- [x] 1.1 Agregar tabla `payment_method_settings` (`pay_at_property_enabled boolean not null default true`, `pay_online_enabled boolean not null default true`, id, timestamps) en `src/persistence/schema.ts`, siguiendo la forma de `company_quotation_breakfast_catalog`, y generar la migración de Drizzle correspondiente
- [x] 1.2 Aplicar la migración en el entorno local y verificar con una consulta directa que la tabla existe con las columnas y defaults esperados — aplicada con `npm run db:migrate` contra la base de `.env.local` (producción) y verificada por consulta directa a `information_schema.columns`

## 2. Repositorio server-side

- [x] 2.1 Definir el tipo `PaymentMethodSettingsRepository` (`get()` / `update(input)`) y su input normalizado/validado, siguiendo el patrón de `CompanyQuotationBreakfastCatalogRepository`
- [x] 2.2 Implementar `createDrizzlePaymentMethodSettingsRepository` que asegura la entrada por defecto en el primer `get()` (igual que breakfast catalog) y escribe cambios en `update()`
- [x] 2.3 Exponer `getServerPaymentMethodSettingsRepository()` en `src/infrastructure/database/` (o el módulo análogo a `company-quotation-source.ts`) y verificar con una prueba unitaria que `get()` devuelve el default habilitado en una base vacía

## 3. Endpoint admin

- [x] 3.1 Crear `app/api/admin/payment-methods/route.ts` con `GET`/`PUT` protegidos por `requireAdministrator()`, siguiendo exactamente el patrón de `app/api/admin/breakfast-catalog/route.ts`
- [x] 3.2 Verificar con una prueba de integración (o manual) que una solicitud sin sesión admin recibe 401 y no modifica la entrada, y que una solicitud autenticada válida persiste el cambio

## 4. UI admin

- [x] 4.1 Crear `src/features/admin/payment-methods-settings.tsx` (client component) con un switch por método, que hace `GET` al cargar y `PUT` al guardar, siguiendo el patrón de `breakfast-catalog-settings.tsx`
- [x] 4.2 Montar `<PaymentMethodsSettings />` junto a `<BreakfastCatalogSettings />` en `app/(admin-protected)/admin/configuracion/page.tsx`
- [x] 4.3 Verificar manualmente en el dashboard admin que deshabilitar y guardar un método persiste tras recargar la página — verificado por el usuario en producción tras aplicar la migración ("funciona perfecto")

## 5. Flujo público — UI

- [x] 5.1 Resolver el estado de métodos de pago server-side (vía `getServerPaymentMethodSettingsRepository().get()`) en el mismo punto donde hoy se resuelve `bookingEnabled`, y propagarlo como props hasta `BookingConfirmationController`
- [x] 5.2 Actualizar `BookingConfirmationController` para ocultar el radio button de un método deshabilitado, manteniendo sin cambios la regla existente de `roomCount === 1` para pago online
- [x] 5.3 Verificar con una prueba de componente/unitaria que con `payOnlineEnabled: false` no se renderiza la opción de pago online, y que con ambos flags en `false` no se renderiza ninguna opción

## 6. Flujo público — validación en servidor

- [x] 6.1 En `app/api/bookings/pay-at-property/route.ts`, verificar `payAtPropertyEnabled` antes de confirmar la reserva y rechazar con el mismo tipo de error 4xx usado para `bookingEnabled=false` si está deshabilitado
- [x] 6.2 En `app/api/bookings/fintoc-checkout/route.ts`, verificar `payOnlineEnabled` antes de iniciar el checkout y rechazar de la misma forma si está deshabilitado
- [x] 6.3 Verificar con pruebas de integración que una solicitud directa a cada endpoint con el método correspondiente deshabilitado es rechazada sin crear ni confirmar la reserva

## 7. Validación final

- [x] 7.1 Ejecutar `openspec validate admin-manage-payment-methods --strict` (con `--store` si aplica) y corregir cualquier hallazgo antes de aplicar el change
