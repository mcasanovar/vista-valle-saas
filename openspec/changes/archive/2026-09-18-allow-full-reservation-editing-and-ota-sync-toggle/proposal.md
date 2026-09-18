## Why

Hoy la edición de una reserva depende de su origen: las reservas de Airbnb/Booking no pueden corregirse localmente (fechas bloqueadas, y no existe ninguna vía para corregir nombre, apellido, correo o teléfono del huésped en ninguna reserva). En la práctica el equipo administrador necesita poder corregir estos datos siempre —por ejemplo, un huésped que se equivocó al escribir su correo o una fecha mal digitada— sin que el origen del canal se lo impida. Al mismo tiempo, se está por definir una integración más robusta con Airbnb/Booking a futuro, así que mientras tanto se necesita poder pausar el intercambio de datos con esos canales sin perder la configuración actual, para reactivarlo cuando esa propuesta esté lista.

## What Changes

- Eliminar la restricción por origen (`airbnb`/`booking`) que bloquea la edición de `check-in`/`check-out`: **cualquier** reserva, sin importar origen o estado (confirmada, cancelada, completada, no presentada), podrá editar sus fechas.
- **Nueva funcionalidad**: permitir editar nombre, apellido, correo y teléfono del huésped de **cualquier** reserva, sin importar origen o estado. Hoy esta edición no existe en ningún punto del sistema (los datos del huésped se muestran de solo lectura).
- Agregar dos interruptores independientes en `/admin/sincronizaciones` — uno para Airbnb y uno para Booking — que pausan el intercambio de datos con esa plataforma en ambos sentidos: dejan de traerse reservas nuevas (polling entrante) y el calendario que esa plataforma consulta (`/api/ical/[token]`) deja de responder para las conexiones de esa plataforma, para todas las habitaciones. **BREAKING** (temporalmente, mientras el toggle esté apagado): Airbnb/Booking dejarán de recibir información de disponibilidad de las habitaciones cuya plataforma esté pausada.
- Cada interruptor es una capa por encima de la configuración por conexión existente (`enabled` por habitación+plataforma): al apagarlo no se modifica esa configuración, y al reactivarlo cada conexión vuelve a funcionar exactamente como estaba antes de la pausa.

## Capabilities

### New Capabilities
_Ninguna — todos los cambios son requisitos nuevos o modificados sobre capacidades existentes._

### Modified Capabilities
- `reservation-administration`: se elimina la restricción de edición de fechas por origen de canal externo, y se agrega la capacidad de editar nombre, apellido, correo y teléfono del huésped para cualquier reserva.
- `reservation-date-editing`: se elimina el requisito "Elegibilidad por origen" que rechaza la edición de fechas para reservas `airbnb`/`booking`; la edición de fechas queda disponible para cualquier origen.
- `channel-calendar-sync`: se agrega un interruptor de pausa por plataforma (Airbnb, Booking) que detiene el polling entrante y el feed saliente de todas las conexiones de esa plataforma, sin alterar el estado `enabled` individual de cada conexión.

## Impact

- **Código de edición de fechas**: `src/features/reservations/edit-reservation-dates.ts` (`EDITABLE_RESERVATION_ORIGINS`, `assertReservationDatesEditable`), `src/features/admin/edit-reservation-dates-action.ts`, `app/(admin-protected)/admin/reservas/[id]/page.tsx` (gate `canEditDates`), `src/features/assistant/tools/write/edit-reservation-dates-tool.ts`.
- **Nueva edición de datos del huésped**: nueva ruta/acción de servidor para actualizar nombre, apellido, correo y teléfono; nuevo formulario en `app/(admin-protected)/admin/reservas/[id]/page.tsx` (hoy son `<dd>` de solo lectura); posible actualización del tipo de reserva y de la capa de persistencia (`src/infrastructure/database/*`).
- **Sync Airbnb/Booking**: `app/api/internal/channel-sync/poll/route.ts`, `src/features/channel-calendar-sync/poll.ts` (`pollAllActiveConnections`), `app/api/ical/[token]/route.ts`, `src/features/channel-calendar-sync/connections.ts`, `src/infrastructure/database/channel-connections-repository.ts`, panel admin `app/(admin-protected)/admin/sincronizaciones/page.tsx` y su `connections-panel.tsx` (nuevo control de UI para los dos interruptores; hoy `setChannelConnectionEnabledAction` existe pero no está conectado a ninguna UI).
- **Riesgo aceptado**: mientras un interruptor de plataforma esté encendido, editar localmente una reserva de esa plataforma puede desincronizarla de la OTA (la app nunca escribe cambios de vuelta hacia Airbnb/Booking); es responsabilidad del administrador pausar la plataforma correspondiente si quiere evitarlo.
