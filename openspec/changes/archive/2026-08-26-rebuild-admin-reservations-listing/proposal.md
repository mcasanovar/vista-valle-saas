## Why

El módulo de reservas del panel admin (`/admin/reservas`) nunca se conectó de verdad a los datos de producción: la tarea que lo declaraba completo en `build-vista-valle-booking-mvp` (6.3) entrega en realidad un stub — una sola reserva hardcodeada, sin paginación, sin búsqueda real, y una vista de detalle que se bifurca entre dos fuentes mock incompatibles según dónde encuentre el registro. El equipo necesita ahora operar reservas reales desde el panel: listarlas, buscarlas rápido, filtrarlas por fecha, ver su detalle completo (huésped, habitaciones, factura, pagos, auditoría) y actuar sobre ellas (cancelar, marcar no-show, registrar pago presencial).

## What Changes

- **BREAKING**: se elimina por completo la fuente mock de reservas del admin (`src/features/admin/reservations.ts` y su bifurcación con `getMockReservationPaymentAdminView`); de aquí en adelante el módulo de reservas admin opera exclusivamente contra Postgres de producción.
- Se agrega un módulo de lectura dedicado (`admin-reservation-source`) que expone listado paginado (20 por página), búsqueda de texto libre y filtros de fecha, separado de la interfaz transaccional `ReservationRepository` existente.
- Búsqueda de texto libre sobre nombre, apellido, email, teléfono, RUT y empresa del huésped, identificador público de la reserva, y nombre de habitación — explícitamente sin incluir el comentario libre del huésped.
- Filtro de fecha de llegada (principal) y de salida (secundario, oculto por defecto), cada uno soportando tanto fecha exacta como rango mediante un único selector de calendario.
- Chips de atajos rápidos de fecha (hoy, esta semana, próximos 7 días) y filtros adicionales de estado y origen.
- Vista de detalle de reserva completa: huésped, ítems por habitación con subtotales y total agregado, solicitud de factura (condicional), pago(s) asociados, estado de sincronización de canales, y línea de tiempo de auditoría.
- Acción para cancelar una reserva confirmada, sin restricción de fecha (permisivo — el sistema no impide cancelar una reserva cuyo check-in ya pasó).
- Acción para marcar una reserva confirmada como no presentada (`no_show`).
- Nueva acción para registrar el pago de una reserva `pay_at_property` como recibido (monto, fecha, medio, administrador responsable), sin restricción de fecha respecto al término de la estadía; no aplica a reservas pagadas en línea con Fintoc (que solo se gestionan vía reembolso).

## Capabilities

### New Capabilities
(ninguna)

### Modified Capabilities
- `reservation-administration`: reemplaza el requisito de "Gestión de reservas" (listado/filtro/consulta) por una implementación real contra producción con paginación, búsqueda de texto libre y filtros de fecha; agrega el detalle completo de reserva (pagos, factura, auditoría, sincronización); agrega la acción de registro de pago presencial con su restricción de alcance (solo `pay_at_property`); documenta que cancelar una reserva es permisivo respecto a la fecha. Nota: esta capability todavía vive como delta en el change `build-vista-valle-booking-mvp` (no archivado, no sincronizado a `openspec/specs/`); este change agrega un delta adicional sobre la misma capability.

## Impact

- Elimina: `src/features/admin/reservations.ts` (fuente mock) y su uso en `app/(admin-protected)/admin/reservas/page.tsx` y `[id]/page.tsx`.
- Nuevo: `src/infrastructure/database/admin-reservation-source.ts` (listado paginado/búsqueda de dos fases, detalle completo).
- Nuevo: acción de registro de pago presencial contra Postgres (payments, provider `pay_at_property`).
- Reescribe: `app/(admin-protected)/admin/reservas/page.tsx` (listado con filtros/búsqueda/paginación) y `app/(admin-protected)/admin/reservas/[id]/page.tsx` (detalle completo con acciones).
- Nueva dependencia: librería de calendario de rango (ej. `react-day-picker`) para el selector de fecha inteligente, cargada solo en el bundle del admin.
- Reutiliza: `transitionReservationState` (cancelar, no-show) y el patrón de acción de reembolso Fintoc ya existente como referencia de estilo para la acción de pago presencial.
- No afecta el sitio público de reservas ni sus specs existentes.
