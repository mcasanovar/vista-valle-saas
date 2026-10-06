## Context

Ver `proposal.md` - Why. El panel admin no tiene abstracción de tabla/paginación/filtros reutilizable: la sección de Reservas (`app/(admin-protected)/admin/reservas/`) es una composición ad-hoc de piezas acopladas a esa ruta (`reservation-row.tsx`, `reservations-pagination.tsx` con la ruta `/admin/reservas` hardcodeada, `reservations-filter-bar.tsx`, y el `<table>` HTML inline en el `page.tsx`). No hay un componente de tabla genérico que extraer primero. La fuente de datos de reservas (`src/infrastructure/database/admin-reservation-source.ts`) usa paginación en dos fases: fase 1 selecciona solo IDs bajo los filtros (evitando que `LIMIT/OFFSET` se infle por relaciones 1-a-muchos), fase 2 carga el detalle liviano de esos IDs.

La protección real no es el layout (`app/(admin-protected)/admin/layout.tsx`) sino que cada página y cada función de lectura llama `requireAdministrator()` explícitamente — el layout es solo una redirección de UX, documentado así en su propio código.

El esquema de `companyQuotations`/`companyQuotationLines` (`src/persistence/schema.ts`) ya tiene todos los campos necesarios para listado y detalle; no se requiere migración de base de datos.

## Goals / Non-Goals

**Goals:**
- Listado paginado, con búsqueda y filtros, de cotizaciones de empresa en el admin.
- Detalle de una cotización con la misma profundidad de información que tiene hoy el correo que recibe el administrador.
- Reusar el patrón de protección (`requireAdministrator()`) y de paginación en dos fases ya validado en Reservas.

**Non-Goals:**
- No se introduce en este cambio un componente de tabla/paginación genérico compartido entre Reservas y Cotizaciones; se clona el patrón existente, igual que el resto del admin ya hace entre distintas secciones. Extraer una abstracción común es un refactor separado, no bloqueante para esta propuesta.
- No se agrega ningún control de edición, aprobación o cambio de estado de negocio sobre la cotización: es una vista de solo lectura. El único "estado" visible es el de entrega de notificación (`companyQuotationStatusEnum`: `accepted`/`delivered`/`delivery_failed`), ya existente.
- No cambia el flujo público de solicitud de cotización ni el mecanismo de notificación (cubierto por `process-quotation-notifications-after-request`).

## Decisions

### 1. Clonar el patrón de Reservas en vez de generalizar una tabla compartida
El código actual no separó una capa de tabla reusable entre secciones del admin; cada sección (Reservas, y antes de esto, cualquier otra) resuelve su propia tabla/paginación/filtros inline. Generalizar ahora añadiría una abstracción nueva no solicitada y de alcance mayor al pedido. Se sigue el patrón establecido: nuevos archivos `cotizaciones-pagination.tsx`, `cotizaciones-filter-bar.tsx`, `company-quotation-row.tsx` en `src/features/admin/`, análogos a sus equivalentes de reservas pero con la ruta `/admin/cotizaciones` propia.

### 2. Paginación en dos fases, replicando `admin-reservation-source.ts`
Aunque `companyQuotations`/`companyQuotationLines` es una relación 1-a-muchos igual que reservas/items, se replica el mismo enfoque (fase 1: IDs de cotización bajo filtros; fase 2: detalle liviano de esos IDs) por consistencia con el código ya auditado y para evitar que `LIMIT/OFFSET` se infle cuando una cotización tiene varias líneas de habitación.

### 3. Estado de negocio vs. estado de entrega: no se inventa un estado nuevo
`companyQuotationStatusEnum` ya existe pero representa el resultado de la notificación (`accepted`/`delivered`/`delivery_failed`), no un ciclo de vida de aprobación de la cotización como negocio. Esta propuesta no agrega un estado nuevo tipo "aceptada por Vista Valle"/"rechazada": el spec de `company-quotation-flow` ya establece que la cotización queda pendiente de la respuesta por correo del cliente y de gestión operativa manual (fuera del sistema). Introducir un estado de negocio sería una ampliación de alcance no pedida por el usuario; se deja fuera.

### 4. El estado de entrega se deriva de `notification_outbox`, no de `companyQuotations.status`
`companyQuotations.status` existe como enum (`accepted`/`delivered`/`delivery_failed`) pero **ningún código lo actualiza jamás**: toda cotización queda en `accepted`. Filtrar o mostrar por esa columna sería un filtro muerto y una etiqueta engañosa. El estado real de entrega vive en `notification_outbox.status` (`pending`/`processing`/`retrying`/`delivered`/`failed`), una fila por intent (cliente y admin).

Por lo tanto el estado de entrega que ve el administrador se deriva de los intents de esa cotización:
- `delivered`: existe al menos un intent y todos están `delivered`
- `failed`: existe al menos un intent en `failed`
- `pending`: cualquier otro caso, incluida una cotización sin intents

El listado filtra con subconsultas `EXISTS`/`NOT EXISTS` sobre `notification_outbox`, y el detalle lista el estado de cada intent (tipo, estado, intentos, código de error seguro, fecha de entrega) **sin exponer el destinatario**, consistente con `notification-delivery-status.ts`, que deliberadamente omite destinatarios y referencias del proveedor.

## Risks / Trade-offs

- [Clonar en vez de compartir código duplica lógica de paginación/filtros entre Reservas y Cotizaciones] → Mitigación: es el patrón ya existente en el proyecto para otras secciones del admin; no se introduce deuda nueva, solo se sigue la convención. Si en el futuro se decide generalizar, ambos lugares quedan como candidatos claros a refactor.
- [La capa de lectura nueva podría olvidar `requireAdministrator()` en algún punto, dado que no hay un wrapper obligatorio] → Mitigación: replicar exactamente el patrón de `admin-reservation-source.ts` (llamada explícita dentro de la función, no solo en la página) y cubrirlo con un test que verifique rechazo sin autorización.
- [Cotizaciones con muchas líneas de habitación podrían hacer lenta la fase 2 de detalle si no se acota] → Mitigación: el límite práctico ya existe en el dominio (`rooms[]` de una cotización es un conjunto acotado de tipos de habitación del hotel, no una colección sin límite).

## Migration Plan

1. Crear `src/infrastructure/database/admin-company-quotation-source.ts` con `listAdminCompanyQuotations` y `getAdminCompanyQuotationDetail`, replicando la forma de `admin-reservation-source.ts`.
2. Crear `app/(admin-protected)/admin/cotizaciones/page.tsx` (listado) y `app/(admin-protected)/admin/cotizaciones/[id]/page.tsx` (detalle).
3. Crear los componentes de UI (`company-quotation-row.tsx`, `cotizaciones-pagination.tsx`, `cotizaciones-filter-bar.tsx`) en `src/features/admin/`.
4. Agregar la entrada "Cotizaciones" en `navigationGroups` de `admin-shell.tsx`, junto a "Reservas".
5. No requiere rollback especial: es una sección nueva de solo lectura, sin impacto en datos existentes ni en el flujo público.

## Open Questions

(ninguna - el alcance de solo lectura y sin ciclo de vida de aprobación quedó resuelto como decisión explícita arriba)
