## Why

Hoy las cotizaciones de empresa se guardan en la base de datos y se notifican por correo, pero no existe ninguna forma de verlas desde el panel de administración: ni un listado ni un detalle. El administrador no tiene visibilidad operativa de qué cotizaciones se han solicitado sin ir directamente a la base de datos.

## What Changes

- Nueva sección "Cotizaciones" en el panel admin, bajo `/admin/cotizaciones`, siguiendo el mismo patrón visual y de interacción que la sección de Reservas (`/admin/reservas`).
- Listado paginado de cotizaciones con búsqueda y filtros (empresa/contacto/email, fechas de check-in/check-out, estado de entrega de la notificación).
- Página de detalle de una cotización (`/admin/cotizaciones/[id]`) con los datos de la empresa/contacto, estadía, líneas por habitación, desayuno (cuando corresponde), total, mensaje libre, y estado de entrega de sus notificaciones.
- Nuevo link "Cotizaciones" en la navegación del admin (`admin-shell.tsx`), junto a "Reservas".
- Nueva capa de lectura (`admin-company-quotation-source.ts` o equivalente) con paginación en dos fases, análoga a `admin-reservation-source.ts`, protegida con `requireAdministrator()` tanto en las páginas como en las funciones de acceso a datos.

## Capabilities

### New Capabilities

- `admin-company-quotation-management`: listado paginado, búsqueda/filtros y vista de detalle de cotizaciones de empresa en el panel de administración, de solo lectura (sin ciclo de vida de aprobación/rechazo).

### Modified Capabilities

(ninguna - no cambia el comportamiento del flujo público de cotización ni de las notificaciones; esta propuesta solo agrega visibilidad de lectura en el admin)

## Impact

- Nuevas rutas: `app/(admin-protected)/admin/cotizaciones/page.tsx`, `app/(admin-protected)/admin/cotizaciones/[id]/page.tsx`.
- Nueva capa de datos de solo lectura sobre `companyQuotations`/`companyQuotationLines` en `src/infrastructure/database/`.
- Nuevos componentes en `src/features/admin/` análogos a `reservation-row.tsx`, `reservations-pagination.tsx`, `reservations-filter-bar.tsx`, adaptados a cotizaciones.
- `src/features/admin/admin-shell.tsx`: agrega entrada de navegación.
- No afecta `app/api/company-quotations/route.ts` ni el flujo de notificaciones (ver change separado `process-quotation-notifications-after-request`).
