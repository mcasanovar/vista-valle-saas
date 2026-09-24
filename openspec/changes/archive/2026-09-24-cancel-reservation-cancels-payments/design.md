## Context

`transitionAdminReservationWithResult` (`src/features/admin/reservation-actions.ts`) calls the domain `transitionReservationState` (`src/features/reservations/transition-reservation-state.ts`), which runs `reservationRepository.transitionReservationState` inside the room-lock transaction (`roomLockGateway.runLockedMany`). The Drizzle adapter (`src/infrastructure/database/reservation-repository.ts:375-405`) already does, in one `tx`: read current reservation → `assertConfirmedTransition` → update `reservations.status` → insert one `auditEvents` row (`action: "reservation.state_changed"`). There's an established sibling pattern for payment-status writes with audit in `collectPayAtPropertyPayment` (`src/infrastructure/database/admin-payment-collection.ts`): update `payments.status` + insert `auditEvents` with `before`/`after`.

Today this transition deliberately does *not* touch `payments` (see removed requirement "Cancelaciones con pago aprobado" in `payment-processing`). This change reverses that: cancelling now cancels every payment row tied to the reservation, regardless of prior status.

## Goals / Non-Goals

**Goals:**
- Cancelling a reservation (`to: "cancelled"`) atomically cancels all its `payments` rows in the same transaction as the status change.
- Each payment's prior state is preserved in the audit trail, even though it's no longer the live value.

**Non-Goals:**
- No change to `completed`/`no_show` transitions — only `cancelled` touches payments.
- No refund logic, no provider-side cancellation call (Mercado Pago/Fintoc) — this only changes the row in the local `payments` table's `status` column, same as every other payment-status write in this codebase today (`collectPayAtPropertyPayment` does not call out to a provider either).
- No change to holds' payment-adjacent state (holds don't have `payments` rows with `reservationId` set the same way — out of scope).

## Decisions

- **Extend the existing `transitionReservationState` Drizzle transaction** rather than adding a separate post-commit step: when `transition.to === "cancelled"`, after updating `reservations.status`, select all `payments` where `reservationId = updated.id` and `status !== 'cancelled'`, then update each to `cancelled` and insert one `auditEvents` row per payment (`action: "payment.cancelled"`, `before: { status: <prior> }`, `after: { status: "cancelled" }`, `entityType: "payment"`, `entityId: <payment.id>`). Doing it in the same `tx` means a failure to cancel a payment rolls back the reservation cancellation too — no partial state.
- **Mirror the mock repository.** `createMockReservationRepository`'s `transitionReservationState` (`src/features/reservations/reservation-repository.ts:543-558`) must apply the same rule against its in-memory `payments` storage so contract tests between the mock and Drizzle adapters stay equivalent (existing pattern in this codebase — see the adapter-parity tests already covering other transactional methods).
- **No new repository method.** This logic lives inside `transitionReservationState`'s existing implementations rather than becoming a new exported function, since it's not a standalone operation an admin triggers directly — it's a side effect of one specific transition.

## Risks / Trade-offs

- [Cancelling an `approved` (already-charged) payment removes the "still needs a manual refund" signal that `payment-processing`'s old requirement relied on] → Deliberate, user-confirmed scope change (see proposal.md). Mitigated by keeping the prior status in the audit event (`before: { status: "approved" }`), so "this reservation had money collected before it was cancelled" stays discoverable via audit history, just not via the live `payments.status` column anymore.
- [Other code paths may assume an `approved` payment on a cancelled reservation is still `approved`] → `operational-alerts.ts` and any admin reporting that reads `payments.status` directly should be checked during implementation (tasks.md) rather than assumed safe.

## Migration Plan

- Additive transactional logic; no schema change (`cancelled` already exists in `payment_status`). No backfill needed for new cancellations going forward. Existing already-cancelled reservations whose payments are still `approved`/`pending` are **not** retroactively touched by this change — only cancellations that happen after this ships get the new behavior, unless the user separately asks for a backfill.
- Rollback: revert the transaction changes; no data to undo since payments already cancelled by this logic simply keep the `cancelled` status a normal cancellation would also produce.
