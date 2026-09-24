## Why

En el calendario de reservas del admin (`/admin/calendario`), todos los chips de reserva se pintan verdes mientras la reserva esté `confirmed`/`completed`, sin importar si el huésped ya pagó. El administrador no puede identificar de un vistazo qué reservas todavía no tienen pago registrado, y tiene que abrir cada una para revisarlo.

## What Changes

- El color de los chips/barras de reserva en el calendario (grilla clásica, timeline de "Próximos 7 días" y agenda mobile) pasa a depender del estado de pago en vez del estado de la reserva:
  - **Verde**: la reserva tiene al menos un pago `approved`.
  - **Amarillo**: la reserva no tiene ningún pago `approved` (incluye `pending`, `rejected`, `requires_action`, sin pagos registrados, etc.).
- El cálculo de pagada/no pagada reutiliza la misma regla binaria que ya existe para la lista de reservas (`AdminReservationPaymentSummary` en `admin-reservation-source.ts`: pagada si existe un pago `approved`, todo lo demás cuenta como no pagada).
- Fuera de alcance explícito: no se toca el color de retenciones ni bloqueos, no se agrega distinción visual para "no se presentó" más allá de este cambio, y no se modifica el filtro que hoy excluye las reservas `cancelled` del calendario (siguen sin aparecer).
- **BREAKING** (visual, no de datos): el color ya no comunica si una reserva es `confirmed` vs `completed` vs `no_show` — ese matiz deja de tener representación de color propia en el calendario.

## Capabilities

### Modified Capabilities
- `admin-reservation-calendar`: la regla de color de los ítems tipo reserva cambia de "por estado de la reserva" a "por estado de pago (pagada/no pagada)"; retenciones y bloqueos no cambian.

## Impact

- `src/infrastructure/database/admin-calendar-source.ts`: la consulta debe traer también el estado de pago (join con `payments`) para cada reserva incluida.
- `src/features/admin/calendar-item-style.ts`: la función de estilo por ítem deja de leer `item.status` para reservas y pasa a leer un nuevo campo de pago.
- `src/features/admin/calendar-view.tsx`: actualizar la leyenda (`CalendarLegend`) para reflejar "Pagada" / "No pagada" en vez de "Reserva confirmada" / "No se presentó".
- Sin cambios de esquema de base de datos (el estado de pago ya existe en `payments.status`).
