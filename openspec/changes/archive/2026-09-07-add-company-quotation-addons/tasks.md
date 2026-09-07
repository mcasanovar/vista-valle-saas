## 1. Esquema y migración

- [x] 1.1 En `src/persistence/schema.ts`, eliminar la columna `requirements` y agregar `require_parking boolean NOT NULL DEFAULT false` en `companyQuotations`; verificar que el tipo `$inferSelect` ya no exponga `requirements`.
- [x] 1.2 Agregar a `companyQuotations` las columnas `breakfast_requested boolean NOT NULL DEFAULT false`, `breakfast_quantity integer`, `breakfast_unit_price_clp_snapshot integer`, `breakfast_subtotal_clp integer NOT NULL DEFAULT 0`, con el `CHECK` que exige cantidad/precio/subtotal válidos solo cuando `breakfast_requested = true`; verificar el `CHECK` con una inserción de prueba que lo viole.
- [x] 1.3 Definir la tabla `company_quotation_breakfast_catalog` (`id`, `description text NOT NULL`, `unit_price_clp integer NOT NULL CHECK (unit_price_clp >= 0)`, `createdAt`, `updatedAt`) en `schema.ts`.
- [x] 1.4 Generar la migración Drizzle (`drizzle-kit generate`) que aplica los cambios de 1.1–1.3 como DDL puro (sin sembrar filas, ver design.md decisión 3: el proyecto exige migraciones sin `INSERT`/`UPDATE`/`DELETE`, verificado por `tests/migration.test.ts`); verificar con `npm run db:check`.

## 2. Dominio de cotización

- [x] 2.1 En `src/features/company-quotations/quotation.ts`, reemplazar `requirements: string` por `requireParking: boolean` en `CompanyQuotationInput`, `CompanyQuotation` y su normalización; verificar que `normalizeCompanyQuotationInput` rechace un valor no booleano y acepte `true`/`false`.
- [x] 2.2 Agregar a `CompanyQuotationInput`/`CompanyQuotation` los campos `breakfastRequested: boolean`, `breakfastQuantity?: number` y, al resultado calculado, `breakfastUnitPriceClp?: number` y `breakfastSubtotalClp: number`; verificar que `breakfastRequested = false` no exija cantidad y que `true` exija una cantidad entera positiva.
- [x] 2.3 Extender `calculateCompanyQuotation` para recibir el catálogo de desayuno vigente (descripción + precio unitario) y sumar `breakfastSubtotalClp` al `totalClp` cuando `breakfastRequested`; verificar con pruebas unitarias el total con y sin desayuno, y que el precio usado sea el del catálogo pasado como parámetro, no uno enviado por el cliente.
- [x] 2.4 Agregar un tipo y una función de lectura del catálogo de desayuno (por ejemplo `CompanyQuotationBreakfastCatalog` y su contrato de repositorio) en `src/features/company-quotations/`; verificar con tipos y una prueba de contrato mock.

## 3. Persistencia

- [x] 3.1 Actualizar `src/infrastructure/database/company-quotation-repository.ts` (inserción, `withLines`, lectura) para usar `require_parking` y las columnas de snapshot de desayuno en vez de `requirements`; verificar con la prueba de infraestructura existente que ejercita creación y lectura de una cotización.
- [x] 3.2 Actualizar `src/infrastructure/database/company-quotation-source.ts` (fuente productiva usada por el worker de notificaciones) para incluir estacionamiento y desayuno en los datos que reconstruye para la plantilla de correo; verificar que no dependa del repositorio mock.
- [x] 3.3 Implementar el repositorio del catálogo de desayuno (lectura de la fila vigente y actualización de descripción/precio) en `src/infrastructure/database/`, y su contraparte mock en memoria usada por el contexto de desarrollo; verificar con una prueba que la actualización persiste y que la lectura pública siempre devuelve una fila.

## 4. API pública

- [x] 4.1 Incluir el catálogo de desayuno vigente (`description`, `unitPriceClp`) en la respuesta de `app/api/company-quotations/availability/route.ts` (o el endpoint que resuelve disponibilidad antes del formulario); verificar con una prueba de integración de la ruta.
- [x] 4.2 Actualizar `app/api/company-quotations/route.ts` para aceptar `requireParking`, `breakfastRequested` y `breakfastQuantity` en el payload, validar con el dominio actualizado y persistir el snapshot de desayuno; verificar respuestas 400 para desayuno solicitado sin cantidad válida y 200 con el total correcto.

## 5. Formulario público

- [x] 5.1 En `company-quotation-form.tsx`, reemplazar el `FormField` de texto "Requisitos" por un selector Sí/No obligatorio "¿Requiere estacionamiento?" que setea `requireParking`; verificar con una prueba de componente que no se puede enviar sin seleccionar una opción.
- [x] 5.2 Agregar el selector Sí/No "¿Desea desayunos?" con valor por defecto "No"; verificar que en "No" el formulario se comporta igual que antes (sin bloque adicional) y que el payload enviado incluye `breakfastRequested: false`.
- [x] 5.3 Al seleccionar "Sí", mostrar el bloque con la descripción y precio unitario recibidos del catálogo (vía `CompanyQuotationController`/disponibilidad) y un campo numérico obligatorio para la cantidad; verificar validación de cantidad ausente, cero o negativa antes de enviar.
- [x] 5.4 Propagar el catálogo de desayuno desde `company-quotation-controller.tsx` hacia `CompanyQuotationForm` como prop; verificar con una prueba de componente que el precio mostrado coincide con el devuelto por la consulta de disponibilidad.

## 6. Correos

- [x] 6.1 Actualizar `src/features/notifications/email-template-renderer.ts` (`renderCompanyQuotationCustomerEmail`, `renderCompanyQuotationAdminEmail`) para mostrar "Estacionamiento: Sí/No" en vez de "Requisitos", y agregar cantidad, precio unitario y subtotal de desayuno cuando `breakfastRequested`; verificar con las pruebas de plantillas existentes más un caso con y sin desayuno.
- [x] 6.2 Aplicar el mismo cambio a los componentes React equivalentes en `src/features/notifications/email-templates.tsx`; verificar que ambos renderizadores muestren el mismo contenido para un mismo `CompanyQuotationRecord`.
- [x] 6.3 Actualizar `CompanyQuotationEmailData`/`CompanyQuotationRecord` (tipos compartidos) para incluir `requireParking`, `breakfastRequested`, `breakfastQuantity`, `breakfastUnitPriceClp` y `breakfastSubtotalClp`; verificar con `npm run typecheck`.

## 7. Administración del catálogo de desayuno

- [x] 7.1 Crear `app/api/admin/breakfast-catalog/route.ts` con `GET`/`PUT` protegidos por `requireAdministrator()`, validando descripción no vacía y precio entero no negativo; verificar `401` sin sesión y `400` con datos inválidos.
- [x] 7.2 Agregar la entrada de navegación "Configuración" en `src/features/admin/admin-shell.tsx` y la pantalla `/admin/configuracion` con un formulario para editar descripción y precio del desayuno; verificar que guardar actualiza el valor y que una lectura posterior del formulario público refleja el cambio.

## 8. Verificación integrada

- [x] 8.1 Actualizar `tests/company-quotation-form.test.tsx`, `tests/company-quotation-controller.test.tsx` para los nuevos selectores de estacionamiento y desayuno; ejecutar `npm run test:unit`.
- [x] 8.2 Actualizar `tests/company-quotation-notifications.test.ts` y las demás pruebas de dominio/ruta/repositorio (`tests/company-quotation.test.ts`, `tests/company-quotation-repository.test.ts`, `tests/company-quotation-route.test.ts`, `tests/company-quotation-route-availability.test.ts`, `tests/postgres-company-quotation.integration.test.ts`) y `tests/migration.test.ts` (conteo de tablas) para las columnas y el contenido de correo nuevos; `tests/infrastructure-boundaries.test.ts` no referencia cotizaciones y no requirió cambios; ejecutar `npm run test:unit`.
- [x] 8.3 Actualizar `e2e/company-quotation.spec.ts` para cubrir el flujo con y sin desayuno, y con estacionamiento sí/no; ejecutar `npm run test:e2e`. Verificado con `npx playwright test e2e/company-quotation.spec.ts` (7-8/8 passing across runs); un caso con `guests: "1"` falla de forma no determinista entre corridas completas pero pasa siempre en aislamiento — flakiness preexistente del servidor de desarrollo, no del código del cambio (se corrigió además un bug real de accesibilidad detectado en el proceso: `Label htmlFor` apuntando al botón "Sí" sobrescribía su nombre accesible).
- [x] 8.4 Ejecutar `npm run typecheck`, `npm run lint`, `npm run build:test` y `openspec validate --specs`; resolver cualquier regresión antes de dar por completo el cambio. `npm run format:check` seguía fallando en 131 archivos preexistentes no tocados por este cambio (deuda previa del repo); se aplicó `prettier --write` solo a los archivos que este cambio creó o modificó, que ahora pasan el check.
