## Context

See `proposal.md` - Why for the bug. The public pay-at-property flow already has a single, shared composition path for occupancy-aware pricing:

- `resolveRoomNightlyPrice(room, occupancyPrices, guestCount)` — `src/features/rooms/occupancy-pricing.ts`
- `selectedRooms(candidate, roomSource)` — parses an untrusted `rooms` field (`"roomId:guestCount,roomId2:guestCount2"`, via `parseRoomSelectionParam`) into `{ room, guestCount }` pairs, dropping any pair whose `guestCount` is outside the room's capacity — `src/features/reservations/room-selection.ts`
- `toResolvedRoom(entry)` — resolves each pair's nightly price for its own `guestCount` — same file
- `confirmPayAtPropertyBookingWith` in `src/features/reservations/confirm-pay-at-property.ts` wires these together before calling `createMultiRoomPayAtPropertyReservation`

The admin manual-reservation path duplicates the room-resolution step instead of reusing it:

- `resolveManualReservationAvailability` (`src/features/admin/manual-reservation-availability.ts`) projects `RoomReadModel` to `{ capacity, id, name, nightlyPriceClp }`, dropping `occupancyPrices`.
- `manual-reservation-form.tsx` renders one checkbox per room plus a single reservation-level "Cantidad de huéspedes" field, and computes its price preview as `nightlyPriceClp * nights` per room.
- `createManualReservationWith` (`src/features/admin/manual-reservation.ts`) resolves rooms with a plain `roomSource.listActive().find(...)` lookup (`requestedRoomIds`) and passes them straight into `createMultiRoomPayAtPropertyReservation`, so every room's `nightlyPriceClp` is its unresolved base price and `guestCount` is left `undefined` on each room (defaults to `1` inside `computeMultiRoomReservationPricing`).

`createMultiRoomPayAtPropertyReservation` / `computeMultiRoomReservationPricing` (`src/features/reservations/pricing.ts:47-88`) intentionally trust `room.nightlyPriceClp` as already resolved — they only multiply by nights. Occupancy resolution MUST happen before that call, per room. This is true for every caller, not just admin.

## Goals / Non-Goals

**Goals:**
- Admin manual-reservation creation resolves each room's nightly price with `resolveRoomNightlyPrice`, using the guest count assigned to that specific room — identical logic to the public flow.
- Admin's on-screen price preview matches the total that will actually be persisted.
- Reuse the existing `selectedRooms` / `toResolvedRoom` composition instead of writing a second occupancy-resolution path for admin.

**Non-Goals:**
- No changes to `resolveRoomNightlyPrice`, `computeReservationPricing`, `computeMultiRoomReservationPricing`, or the public booking flow — they are already correct and untouched.
- No change to how occupancy prices are configured/stored (covered by `admin-room-pricing`).
- No support for guest counts that vary the *invoice/guest record* independently of room occupancy — the admin form's guest identity fields (name, email, etc.) stay reservation-level, as today.

## Decisions

**1. Give each selected room its own guest-count input, and encode the admin `rooms` field the same way the public flow does (`roomId:guestCount,...`).**
Alternative considered: keep one reservation-level "Cantidad de huéspedes" field and apply it to every selected room. Rejected because it silently produces wrong prices the moment an admin books two rooms with different occupancy (e.g. one single, one double for a shared group) — exactly the class of bug being fixed, just narrower. Per-room guest count is also what "misma lógica que la página web" requires, since the web's `rooms` encoding is inherently per-room.

**2. Reuse `selectedRooms(candidate, roomSource)` and `toResolvedRoom(entry)` inside `createManualReservationWith`, replacing `requestedRoomIds` + raw `roomSource.listActive().find(...)`.**
This is the same function the public flow calls (`confirm-pay-at-property.ts:217,226`), so admin automatically inherits: occupancy price resolution, the existing "guest count outside room capacity drops the room" behavior, and any future fix to that shared function. No new resolution code is written.
Alternative considered: call `resolveRoomNightlyPrice` directly inside `manual-reservation.ts`. Rejected — that would re-implement the untrusted-input parsing and capacity-drop behavior that `selectedRooms` already provides, and drift from the public path over time.

**3. Add `occupancyPrices` to `ManualReservationAvailability.rooms` and to the client `AvailableRoom` type; compute the admin preview by importing the same `resolveRoomNightlyPrice`.**
The preview is a pure client-side render of already-fetched data (no extra request). `resolveRoomNightlyPrice` is small, pure, and has no server-only dependency, so it is safe to import into the client component (`manual-reservation-form.tsx`), the same way other pure pricing helpers are shared today.

**4. Keep the reservation-level `guestCount` form field only for the guest record, not for pricing.**
`createManualReservationWith` already threads `candidate.guestCount` through to guest-input parsing for the primary guest's record (`parseGuestInput`, invoked inside `buildReservationQuote`-adjacent flows). That is a distinct concern (who is the primary contact) from per-room occupancy pricing and is out of scope here.

## Addendum: unrelated bug fixed during verification

Manual verification of task 5.2 surfaced a pre-existing, unrelated defect: navigating months in the check-out date picker (Chrome) closed the picker and re-fired the availability query before a day in a different month could be selected.

First attempt: the check-in/check-out inputs were React-controlled (`value={checkIn}`), so every `onChange` re-render reasserted `.value` on the native `<input type="date">`; switching to uncontrolled (`defaultValue`) removed that reassertion but did not fix the bug - the picker still closed on every month navigation.

Root cause: React's `onChange` for `<input type="date">` is driven by the native "input" event, which fires on every intermediate interaction once the field already holds a complete date (e.g. each arrow press while browsing months keeps day/year filled in, so the browser reports a new complete value immediately) - not only when a date is actually committed. That fired `updateDate` (and its side effects: availability fetch, room/guest-count reset) mid-navigation, and it was the native browser behavior in response to that event, not React's re-render, closing the picker.

Fix: replace `onChange` with a native "change" event listener attached via ref (`useCommittedDateChange`), since the native "change" event only fires once a date is actually committed - a day is picked, or a complete value is entered then the field loses focus. Verified manually by the user: navigating months no longer triggers a reload or closes the picker.

## Risks / Trade-offs

- **UI complexity**: adding a per-room guest-count control changes a form admins are already used to. Mitigation: default each room's guest count to `1` (matching current behavior) so no workflow breaks unless an admin actively changes it; validate each value against that room's capacity, reusing the same drop-if-out-of-range behavior as `selectedRooms`.
- **FormData encoding change**: switching `roomIds[]` → a single encoded `rooms` string is a breaking change to the server action's expected fields. Mitigation: `manual-reservation-action.ts` and its field-error mapping (`ManualReservationActionField`) must be checked/updated together with the form and `createManualReservationWith` in the same task, and existing tests for the admin manual-reservation flow updated in lockstep.
- **Divergence between preview and server** if the client ever computes pricing differently from `resolveRoomNightlyPrice` (e.g. a future occupancy-pricing rule). Mitigation: preview imports the exact same pure function rather than reimplementing the tier lookup.
