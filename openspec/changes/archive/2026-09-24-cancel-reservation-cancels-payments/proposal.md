## Why

Hoy cancelar una reserva no toca el estado de sus pagos (`transitionAdminReservationWithResult`, comentario explícito: "Never touches payment state"), y el spec `payment-processing` codifica esto: un pago aprobado se preserva al cancelar y el panel solo advierte que requiere resolución financiera manual. El administrador quiere que cancelar la reserva marque directamente sus pagos como `cancelled`, sin importar el estado que tuvieran, para no tener que gestionar el estado del pago por separado.

## What Changes

- **BREAKING**: al cancelar una reserva (transición a `cancelled` vía `transitionAdminReservationWithResult`), **todos** los pagos asociados a esa reserva pasan a `status = 'cancelled'`, sin importar su estado previo (`pending`, `approved`, `rejected`, `requires_action`, etc.).
- Esto reemplaza la regla actual de "preservar el pago aprobado y advertir en el panel" por "cancelar el pago automáticamente". Ya no hay una advertencia de "resolución financiera pendiente" basada en que el pago siga `approved`, porque el pago deja de reflejar que el dinero fue cobrado.
- Cada cambio de estado de pago generado por esta transición queda registrado como evento de auditoría (actor, estado anterior, estado nuevo), igual que los demás cambios de estado de pago ya auditados en el sistema (`payment.collected`), de modo que el hecho de que un pago estuvo `approved` antes de cancelarse no se pierde, solo deja de ser el estado vigente.
- Sin cambios de esquema: `payment_status` ya incluye `cancelled`.

## Capabilities

### Modified Capabilities
- `payment-processing`: la regla "Cancelaciones con pago aprobado" cambia de preservar el pago aprobado a cancelarlo automáticamente junto con la reserva.
- `reservation-administration`: la auditoría de "Cancelación administrativa" se extiende para cubrir también el cambio de estado de los pagos asociados, no solo el de la reserva. Además, el listado de reservas gana un requisito nuevo: el estado de pago de una reserva cancelada se muestra como cancelado (no pendiente ni pagado) — hallazgo detectado durante la implementación (ver Impact) y confirmado con el usuario.

## Impact

- `src/features/reservations/reservation-repository.ts` / `src/infrastructure/database/reservation-repository.ts`: la transición de estado de reserva a `cancelled` debe incluir la actualización de todos los pagos asociados a `cancelled` dentro de la misma operación (transaccional).
- `src/infrastructure/database/admin-payment-collection.ts` (o un módulo equivalente nuevo): agregar la función que cancela todos los pagos de una reserva, siguiendo el mismo patrón de auditoría que `collectPayAtPropertyPayment`.
- `src/features/admin/reservation-actions.ts`: el comentario y comportamiento actual de "nunca toca el estado de pago" queda obsoleto y debe actualizarse.
- Cualquier lugar que hoy asuma que un pago `approved` de una reserva cancelada sigue `approved` (paneles, reportes, alertas operacionales como `operational-alerts.ts`) debe revisarse para no asumir ese invariante.
- `src/infrastructure/database/admin-reservation-source.ts` y `app/(admin-protected)/admin/reservas/page.tsx`: `AdminReservationPaymentSummary` gana un tercer valor `"cancelled"` para que la columna de pago del listado de reservas no muestre "Pendiente" en una reserva cancelada cuyo pago pasó a `cancelled` — detectado al revisar el impacto de este cambio (tarea 3.2), fuera del impacto previsto originalmente.
