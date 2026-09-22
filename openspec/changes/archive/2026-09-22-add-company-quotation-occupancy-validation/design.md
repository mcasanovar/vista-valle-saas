## Context

`company-quotation-flow` today selects rooms with a boolean toggle (`quantity` is always 0 or 1, capped to one unit per room type — see "Máximo una unidad por tipo"). Capacity is only checked in aggregate (`sum(room.capacity * quantity)` vs `guestCount`) and is advisory: `capacityShortfall` in `company-quotation-form.tsx`/`company-quotation-controller.tsx` lets the visitor submit anyway with the "cotización parcial" message. See proposal.md - Why.

The reservation flow already solves the same distribution problem with a small, pure, already-tested module: `src/features/reservations/guest-allocation.ts` (`computeGuestAllocation`, `isOccupancySelectable`, `remainingGuestsExcludingRoom`, `describeGuestAllocation`), operating on `RoomOccupancySelection = { roomId, guestCount }[]` from `src/features/reservations/room-selection-codec.ts`. Server-side, `src/features/reservations/room-selection.ts`'s `selectedRooms()` clamps/drops any selection whose `guestCount` exceeds `room.capacity`.

## Goals / Non-Goals

**Goals:**
- Reuse the reservation flow's guest-allocation rules for company quotations instead of re-deriving them.
- Make the client-side blocking and the server-side rejection enforce the same invariant: sum of per-room `guestCount` across selected rooms SHALL equal `guestCount` exactly before a quote can be created.
- Keep the one-unit-per-room-type constraint unchanged; only the "what does that one unit hold" and "is submission allowed" behavior changes.

**Non-Goals:**
- Changing the reservation flow itself.
- Supporting more than one unit per room type in a quote (out of scope; untouched by this change).
- Redesigning the availability pre-check step beyond blocking when aggregate available capacity can't possibly reach `guestCount` (see spec delta, "Disponibilidad insuficiente").

## Decisions

**Reuse `guest-allocation.ts` directly rather than forking it.** The module is already pure, already imports only `RoomOccupancySelection`, and has no reservation-specific state baked in (no dates, no pricing, no session storage). Company quotations can construct their own `RoomOccupancySelection[]` (room slug as `roomId`) client-side and call the same three functions. Alternative considered: duplicate the logic under `src/features/company-quotations/` — rejected, since it would let the two flows drift on the exact same invariant (this is precisely the bug the proposal is fixing).

**Add `guestCount` alongside the existing `quantity` in `CompanyQuotationRoomSelection`, rather than replacing `quantity`.** `quantity` is not a UI-only artifact capped at 1: `calculateCompanyQuotation`, the persisted snapshot, and the email templates already support and render multi-unit lines of the same room type (e.g. "2 × Habitación Individual" in `tests/company-quotation-notifications.test.ts`, `tests/company-quotation.test.ts`), even though today's form only ever sends `quantity: 1` (capped by "Máximo una unidad por tipo"). Removing `quantity` would silently break that tested, rendered behavior — out of scope for this change. Instead, `guestCount` is validated against `quantity * room.capacity` (a line can house at most its selected units' combined capacity), and `calculateCompanyQuotation`'s subtotal keeps multiplying by `quantity` exactly as today; `guestCount` doesn't affect price (Vista Valle prices by room, not by occupant).

**Server-side validation happens in two places**, mirroring the reservation flow's split:
1. Per-line: reject if `guestCount` is not a positive integer `<= quantity * room.capacity` (in `normalizeCompanyQuotationInput`/`calculateCompanyQuotation`, alongside the existing `positiveInteger` checks — the capacity bound needs the resolved room, so it's checked where `room.capacity` is already resolved).
2. Cross-line: reject if `sum(line.guestCount) !== input.guestCount` (in `calculateCompanyQuotation`, after resolving `activeRooms`, since it needs the resolved room list to have already validated per-line capacity — matching where `capacity`/`lines` are currently computed).

Both throw `CompanyQuotationInputError` with a field-scoped issue, consistent with existing error handling — no new error type needed.

**Availability pre-check ("Disponibilidad insuficiente")**: block advancing to the room-selection form when the summed capacity of available rooms (respecting one-unit-per-type) is less than `guestCount`, since no distribution could ever reach the target. This reuses the existing capacity-sum arithmetic already present in that step; only the resulting UI branch changes (from "show form, allow partial" to "don't show form").

## Risks / Trade-offs

[Removing "cotización parcial" is a behavior change for sales/reception staff who may rely on sending partial quotes today] → Confirmed explicitly by the user as the desired behavior (no partial quotes going forward); communicate the change in the PR description so anyone relying on the old email wording is aware.

[Client-side blocking alone is not authoritative] → Server-side rejection in `normalizeCompanyQuotationInput`/`calculateCompanyQuotation` is the actual trust boundary, matching the reservation flow's `selectedRooms()` pattern.

[Renaming `quantity` → `guestCount` on `CompanyQuotationRoomSelection` is a shape change touching persistence/email templates] → Confined to this one change; snapshot fields already stored per quotation (`capacity`, `name`, `nightlyPriceClp`, etc.) get `guestCount` added/renamed alongside them, and email templates read the same snapshot so their affected lines are mechanical.

## Migration Plan

No data migration: company quotations are generated fresh per submission and previously saved quotations keep their existing persisted snapshot (this change doesn't rewrite historical records, only the input contract and calculation for new submissions). Deploy as a single change: client form, server validation, and email copy move together since they share the same request/response contract.

## Open Questions

None — the one behavior decision that mattered (no partial quotes) was confirmed with the user during exploration.
