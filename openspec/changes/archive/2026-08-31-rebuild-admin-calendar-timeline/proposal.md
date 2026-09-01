## Why

La pantalla `/admin/calendario` existe pero no es un calendario funcional: es una tabla plana con tres registros hardcodeados (`mockItems`), y `getAdminCalendar` devuelve `null` en producción, por lo que en producción la pantalla simplemente informa "El calendario no está disponible". El administrador no tiene hoy ninguna forma visual de ver la ocupación real de las habitaciones en el tiempo, aunque el modelo de datos (`reservations`, `reservation_holds`, `room_blocks`) ya soporta esa consulta. El uso real será mayormente desde el teléfono, así que la reconstrucción debe diseñarse mobile-first, no adaptarse desde una vista de escritorio.

## What Changes

- Conectar el calendario admin a datos reales de producción (reservas, retenciones y bloqueos por habitación), reemplazando la fuente mock. **BREAKING**: elimina el comportamiento mock-only actual de `getAdminCalendar`/`createAdminCalendarSource`.
- Reemplazar la tabla plana por una vista de **timeline por habitación** (filas = habitaciones, columnas = días), con color por estado de reserva/retención/bloqueo e ícono por canal de origen.
- Agregar selector de rango con 4 presets: Semana, 2 semanas, Próximos 7 días y Mes (**Mes es el default**), más un toggle de granularidad dentro de la vista Mes (día a día vs. semanal comprimida con % de ocupación por semana).
- Agregar indicador visual de "hoy" (línea vertical) y sombreado de fines de semana.
- Agregar creación rápida de reserva/bloqueo desde una celda vacía (precarga habitación + fecha en el formulario manual existente), y un panel de detalle al tocar una celda ocupada con link a la reserva/bloqueo completo.
- Diseño **mobile-first**: en pantallas angostas el timeline horizontal se reemplaza por una agenda vertical por día; el timeline de filas×columnas es el layout de escritorio/tablet, no al revés.
- Micro-interacciones con `framer-motion` (ya en el proyecto): transición direccional entre rangos, entrada sutil de barras, panel de detalle tipo sheet con spring, respetando `prefers-reduced-motion`.
- Filtros por habitación y origen siguiendo el mismo patrón de query params que `/admin/reservas` (`ReservationsFilterBar`).

## Capabilities

### New Capabilities
- `admin-reservation-calendar`: vista de calendario/timeline del panel admin que muestra ocupación real (reservas, retenciones, bloqueos) por habitación y en el tiempo, con navegación de rango, filtros, creación rápida y panel de detalle, mobile-first.

### Modified Capabilities
(ninguna — `admin-dashboard-shell` ya declara "Calendario" como sección de navegación y no cambia su contrato)

## Impact

- `src/features/admin/calendar.ts`: reemplazar `createAdminCalendarSource`/mock por una fuente que consulte `reservations`, `reservation_holds` y `room_blocks` vía la capa de base de datos de producción (mismo patrón que `admin-reservation-source.ts` usado por `/admin/reservas`).
- `src/features/admin/calendar-view.tsx`: reescribir como vista de timeline (no tabla), con variantes desktop/tablet (grid) y mobile (agenda vertical).
- `app/(admin-protected)/admin/calendario/page.tsx` y `loading.tsx`: nuevos query params de rango/granularidad/filtros; loading state con el shimmer ya existente (`admin-dashboard-shimmer`).
- Nuevos tokens de color admin para `hold` y `block` en `app/globals.css`, junto a los ya existentes `--admin-reservation-*`.
- Nuevo componente de panel de detalle (sheet) y de creación rápida, reutilizando los flujos manuales de reserva/bloqueo ya existentes (`enhance-admin-manual-reservations`, `/admin/bloqueos`).
- Dependencia nueva de uso: `framer-motion` (ya está en `package.json`, no se agrega dependencia).
