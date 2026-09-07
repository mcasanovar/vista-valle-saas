## Why

El campo "requisitos" de la cotización empresarial es texto libre pero en la práctica solo se usa para preguntar por estacionamiento, lo que genera respuestas ambiguas y un campo obligatorio innecesario. Además, Vista Valle quiere ofrecer desayunos como servicio adicional cotizable, con su descripción y precio administrables desde el panel admin en vez de quedar codificados en el formulario.

## What Changes

- **BREAKING**: reemplazar el campo "Requisitos" (texto libre, obligatorio, columna `requirements` en `company_quotations`) por un selector booleano "¿Requiere estacionamiento?" persistido en la columna `require_parking`.
- Agregar al formulario un selector booleano "¿Desea desayunos?" con valor por defecto "No":
  - En "No", el resto del flujo no cambia y se persiste como `false`.
  - En "Sí", se despliega un bloque con la descripción de lo que incluye el desayuno, su precio unitario y un campo numérico para la cantidad deseada.
- Agregar una tabla de catálogo de desayuno (descripción + precio unitario en CLP) con una única fila vigente, administrable desde el dashboard admin.
- Agregar una sección en el dashboard admin para editar la descripción y el precio del desayuno del catálogo.
- Incluir el desayuno (cantidad, precio unitario snapshot, subtotal) en el cálculo del total de la cotización, en el snapshot persistido y en ambos correos (cliente y operativo).
- Actualizar el correo operativo para mostrar "Estacionamiento: Sí/No" en vez de "Requisitos".

## Capabilities

### New Capabilities

- `company-quotation-breakfast-catalog`: catálogo de una sola entrada (descripción + precio CLP) para el desayuno ofrecido en cotizaciones empresariales, editable desde el dashboard admin y consumido por el formulario público.

### Modified Capabilities

- `company-quotation-flow`: reemplaza el campo de requisitos por un selector de estacionamiento, agrega el selector y cálculo de desayunos, y actualiza el contenido de ambos correos de cotización.

## Impact

- Base de datos: `src/persistence/schema.ts` — columna `company_quotations.requirements` reemplazada por `require_parking` (boolean); nuevas columnas de snapshot de desayuno (`breakfast_requested`, `breakfast_quantity`, `breakfast_unit_price_clp_snapshot`, `breakfast_subtotal_clp`) en `company_quotations`; nueva tabla de catálogo de desayuno; migración Drizzle nueva.
- Dominio: `src/features/company-quotations/quotation.ts` (input, cálculo, validación), nuevo tipo/lectura del catálogo de desayuno.
- Persistencia: `src/infrastructure/database/company-quotation-repository.ts`, `src/infrastructure/database/company-quotation-source.ts`, nuevo repositorio del catálogo de desayuno.
- API: `app/api/company-quotations/route.ts`, nueva ruta admin para leer/actualizar el catálogo de desayuno.
- Frontend público: `src/presentation/organisms/company-quotation-form.tsx`, `src/presentation/organisms/company-quotation-controller.tsx`.
- Frontend admin: `src/features/admin/admin-dashboard-view.tsx` o nueva vista/sección del panel admin, `src/features/admin/admin-shell.tsx` (nueva entrada de navegación si aplica).
- Notificaciones: `src/features/notifications/email-template-renderer.ts`, `src/features/notifications/email-templates` (tipos), datos de estacionamiento y desayuno en ambos correos.
- Pruebas: `tests/company-quotation-form.test.tsx`, `tests/company-quotation-controller.test.tsx`, `tests/company-quotation-notifications.test.ts`, `tests/infrastructure-boundaries.test.ts`, `tests/admin-dashboard-summary.test.tsx` (si aplica), `e2e/company-quotation.spec.ts`.
