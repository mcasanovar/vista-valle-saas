## Context

`company_quotations` hoy persiste `requirements` (texto libre, `NOT NULL`) y no tiene ningún campo de desayuno. El dominio (`src/features/company-quotations/quotation.ts`) valida y calcula la cotización sin conocer desayunos. El formulario público (`company-quotation-form.tsx`) tiene un `FormField` de texto para "Requisitos". Los correos se generan por dos vías con el mismo contenido: `email-template-renderer.ts` (HTML string, usado por el worker de entrega productivo) y `email-templates.tsx` (componentes React, usados para previsualización/mock); ambos leen `CompanyQuotationEmailData = CompanyQuotationRecord`, así que agregar campos al record los propaga a ambos automáticamente si se tipan ahí.

No existe hoy ninguna superficie admin de "contenido/configuración" fuera de la pantalla Resumen (`admin-dashboard-shell`); el admin shell (`admin-shell.tsx`) define su navegación como una lista fija de secciones (Resumen, Calendario, Reservas, Bloqueos, Sincronizaciones, Alertas, Asistente). El acceso admin usa `requireAdministrator()` (ver `app/api/admin/dashboard/route.ts`) devolviendo `401` sin sesión válida.

## Goals / Non-Goals

**Goals:**

- Reemplazar `requirements` por un booleano `require_parking` en todo el recorrido: schema, dominio, repositorio, formulario, correos.
- Modelar el desayuno como una entrada única de catálogo (descripción + precio CLP) editable desde el admin, y reflejar su selección/cantidad como snapshot en cada cotización.
- Mantener el patrón existente de snapshot (precio no cambia retroactivamente cotizaciones ya guardadas), igual que hoy ocurre con habitaciones.
- Reusar `requireAdministrator()` para proteger la edición del catálogo.

**Non-Goals:**

- Múltiples tipos de desayuno o catálogo con historial de precios (confirmado con el usuario: una sola entrada vigente).
- Migrar o preservar datos históricos de `requirements`: no hay cotizaciones productivas creadas manualmente que requieran migración de datos (`activate-company-quotation-production` aún no se ha habilitado en producción); la columna se reemplaza directamente.
- Rediseñar la navegación completa del admin shell; solo se agrega un punto de entrada a la edición del catálogo.

## Decisions

### 1. Migración de columna: reemplazo directo, no coexistencia

`requirements` se elimina y `require_parking boolean NOT NULL DEFAULT false` se agrega en la misma migración. Se descarta mantener ambas columnas en paralelo (agregar `require_parking` y dejar `requirements` nullable) porque el campo de texto libre no tiene un mapeo automático confiable a un booleano y el flujo aún no está en producción con datos reales que proteger.

### 2. Columnas de snapshot de desayuno en `company_quotations`

Se agregan a `company_quotations`: `breakfast_requested boolean NOT NULL DEFAULT false`, `breakfast_quantity integer`, `breakfast_unit_price_clp_snapshot integer`, `breakfast_subtotal_clp integer NOT NULL DEFAULT 0`. Las tres columnas de detalle son nulas cuando `breakfast_requested = false` y obligatorias (con `CHECK` de positivos) cuando es `true`, vía `CHECK ((NOT breakfast_requested) OR (breakfast_quantity > 0 AND breakfast_unit_price_clp_snapshot >= 0 AND breakfast_subtotal_clp >= 0))`. Se descarta modelar el desayuno como una línea adicional en `company_quotation_lines` (que hoy representa habitaciones con `room_slug`/capacidad) porque el desayuno no tiene capacidad ni tipo de habitación y forzar ese modelo agregaría columnas nulas a todas las líneas de habitación.

### 3. Catálogo de desayuno: tabla de una sola fila, sembrada de forma perezosa

Nueva tabla `company_quotation_breakfast_catalog` con `id`, `description text NOT NULL`, `unit_price_clp integer NOT NULL CHECK (unit_price_clp >= 0)`, `updated_at`. El repositorio de lectura/escritura siempre opera sobre "la primera fila" (`ORDER BY created_at ASC LIMIT 1`) sin exponer un flujo de creación de filas adicionales; se descarta una tabla `key/value` genérica de configuración porque agrega indirección sin necesidad ante un solo valor tipado.

La fila con el contenido placeholder editable **no** se siembra desde la migración: `tests/migration.test.ts` exige que toda migración sea DDL puro (rechaza `INSERT`/`UPDATE`/`DELETE`/`COPY`), un contrato ya establecido en el proyecto y descubierto durante la implementación. En su lugar, el repositorio crea la fila de forma perezosa (`INSERT ... SELECT` primero, o al primer `GET`/`PUT` si no existe) la primera vez que se lee o edita el catálogo, preservando el mismo resultado observable ("el catálogo siempre está disponible para lectura o edición") sin violar ese contrato.

### 4. Snapshot del precio al momento de cotizar

`calculateCompanyQuotation` (en `quotation.ts`) recibirá el catálogo de desayuno vigente (igual patrón que hoy recibe `activeRooms`) y, si `breakfastRequested`, calculará `breakfastSubtotalClp = breakfastQuantity * catalogUnitPriceClp`, sumándolo al `totalClp`. El precio unitario y el subtotal calculados se guardan como snapshot en la cotización, igual que ya ocurre con precios de habitación por línea.

### 5. Formulario: selectores booleanos, no checkbox suelto

"¿Requiere estacionamiento?" y "¿Desea desayunos?" se implementan como un grupo Sí/No (dos botones tipo radio, consistente con el patrón de selección visual ya usado para habitaciones) en vez de un `<select>` o checkbox, para mantener consistencia visual con el resto del formulario y evitar el estado "sin responder" implícito de un checkbox. Ambos son obligatorios (deben tener una selección explícita) salvo que ya tengan un valor por defecto: estacionamiento no tiene default (debe elegirse), desayuno sí tiene default "No" según lo pedido.

Cuando "¿Desea desayunos?" es "Sí", el bloque adicional (descripción, precio unitario, cantidad) se obtiene vía la misma respuesta de disponibilidad/formulario inicial (se añade al payload de `GET /api/company-quotations/availability`, que ya se consulta antes de montar el formulario) en vez de un fetch adicional, evitando una llamada de red extra solo para el catálogo.

### 6. Administración del catálogo: nueva sección "Configuración" en el admin shell

Se agrega una entrada de navegación "Configuración" (`/admin/configuracion`) en `admin-shell.tsx` con una única ruta admin protegida (`app/api/admin/breakfast-catalog/route.ts`, `GET`/`PUT`) que reutiliza `requireAdministrator()`, siguiendo el mismo patrón que `app/api/admin/dashboard/route.ts`. Se descarta anexar la edición dentro de la pantalla Resumen (`admin-dashboard-shell`) porque esa capacidad ya tiene un contrato de KPIs/gráficos bien definido y mezclar un formulario de edición de catálogo ahí rompería su alcance.

## Risks / Trade-offs

- [Riesgo] Cotizaciones ya creadas en ambientes de desarrollo/staging quedan con `requirements` perdido tras la migración → [Mitigación] no hay datos productivos que preservar (ver Non-Goals); se documenta en la migración que el reemplazo es intencional y no reversible.
- [Riesgo] Si la tabla de catálogo llega a tener cero filas (por un `DELETE` manual fuera de la app), el formulario no podría mostrar el bloque de desayuno → [Mitigación] el repositorio crea la fila por defecto de forma perezosa en el próximo `GET`/`PUT`, y la ruta admin solo permite editar, nunca `DELETE`.
- [Riesgo] Agregar el catálogo a la respuesta de disponibilidad acopla dos capacidades distintas en un mismo endpoint → [Mitigación] el catálogo se expone como una sección independiente y opcional del payload (`breakfast: { description, unitPriceClp }`), sin mezclar su validación con la de disponibilidad de habitaciones.

## Migration Plan

1. Crear la migración Drizzle (DDL puro) que elimina `requirements`, agrega `require_parking` y las columnas de snapshot de desayuno en `company_quotations`, y crea `company_quotation_breakfast_catalog`; la fila única del catálogo se crea de forma perezosa en el primer acceso (ver decisión 3), no desde la migración.
2. Actualizar el dominio (`quotation.ts`): input/validación/cálculo para `requireParking` y desayuno.
3. Actualizar repositorio y fuente de datos productiva (`company-quotation-repository.ts`, `company-quotation-source.ts`) para las nuevas columnas y el nuevo repositorio de catálogo.
4. Actualizar `app/api/company-quotations/availability/route.ts` (o el endpoint correspondiente) para incluir el catálogo de desayuno vigente en su respuesta.
5. Actualizar formulario y controlador (`company-quotation-form.tsx`, `company-quotation-controller.tsx`) con los nuevos selectores y el bloque de desayuno.
6. Actualizar `email-template-renderer.ts` y `email-templates.tsx` para mostrar estacionamiento y desayuno en ambos correos.
7. Agregar la ruta admin (`app/api/admin/breakfast-catalog/route.ts`) y la vista de edición, más la entrada de navegación en `admin-shell.tsx`.
8. Actualizar los tests listados en el proposal y `openspec/specs/company-quotation-flow` (vía `/opsx:sync` o archive) una vez implementado.

No aplica rollback de datos: al no haber datos productivos de `requirements`, revertir el release simplemente revierte el código y una migración `down` que recrea la columna vacía si fuese necesario.
