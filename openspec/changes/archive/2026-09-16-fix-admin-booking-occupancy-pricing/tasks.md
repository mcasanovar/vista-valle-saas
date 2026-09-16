## 1. Availability data: expose occupancy prices to admin

- [x] 1.1 Add `occupancyPrices` to `ManualReservationAvailability.rooms` in `src/features/admin/manual-reservation-availability.ts` and populate it from `RoomReadModel.occupancyPrices` in `resolveManualReservationAvailability`; verify with a unit/integration test asserting the availability response includes each returned room's `occupancyPrices`.

## 2. Server-side manual reservation: resolve price by occupancy

- [x] 2.1 Change `createManualReservationWith` (`src/features/admin/manual-reservation.ts`) to build rooms via `selectedRooms(candidate, roomSource)` + `toResolvedRoom(entry)` (from `src/features/reservations/room-selection.ts`), replacing `requestedRoomIds` and the raw `roomSource.listActive().find(...)` lookup, so each room passed to `createMultiRoomPayAtPropertyReservation` carries its resolved `nightlyPriceClp` and its own `guestCount`.
- [x] 2.2 Update the "Unknown room" / empty-selection error path to match `selectedRooms`' behavior (drops rooms with out-of-range guest count, requires distinct room ids) and verify with a test that submitting a `rooms` value with an out-of-range guest count for one room is rejected the same way the public flow rejects it.
- [x] 2.3 Add/adjust unit tests for `createManualReservationWith` asserting the persisted reservation items use the occupancy-resolved nightly price (not the room's base price) when occupancy prices are configured, and fall back to the base price when they are not.

## 3. Server action & contract: switch from `roomIds[]` to encoded `rooms`

- [x] 3.1 Update `createManualReservationAction` (`src/features/admin/manual-reservation-action.ts`) to read a single `rooms` field (encoded `roomId:guestCount,...`) instead of `formData.getAll("roomIds")`, forwarding it to `createManualReservation` unchanged.
- [x] 3.2 Update `ManualReservationActionField` and the "Unknown room" / capacity / availability-conflict field-error mappings in `manual-reservation-action.ts` to reference the new `rooms` field where they previously referenced `roomIds`, and verify existing action tests still pass with updated field expectations.

## 4. Admin form: per-room guest count and honest price preview

- [x] 4.1 Extend the client `AvailableRoom` type and rendering in `manual-reservation-form.tsx` to include `occupancyPrices`, and add a per-room guest-count input (defaulting to `1`, bounded by that room's `capacity`) alongside each room's checkbox.
- [x] 4.2 Build the submitted `rooms` FormData field by encoding each selected room's id and its own guest-count value (`roomId:guestCount,...`), removing the old `roomIds` checkboxes' raw submission and the reservation-level pricing role of the `guestCount` field (that field remains only for the guest record).
- [x] 4.3 Rewrite `pricingSummary()` to compute each selected room's nightly price via `resolveRoomNightlyPrice` (using that room's `occupancyPrices` and its own guest-count input) instead of `room.nightlyPriceClp * nightsCount`, and verify the displayed total updates when a room's guest count changes.
- [x] 4.4 Update form validation (`validate()`) to check the new `rooms` field/per-room guest-count inputs instead of `roomIds`, and verify the existing "select at least one room" and capacity error messages still surface correctly.

## 5. End-to-end verification

- [x] 5.1 Add/update an integration test covering: admin selects two rooms with different guest counts (one at a differentiated tier, one at the base/fallback tier) and confirms a manual reservation; assert the persisted reservation's per-room totals match what `resolveRoomNightlyPrice` would compute for each room's guest count — mirroring the assertion already made for the public pay-at-property flow.
- [x] 5.2 Manually verify in the running admin dashboard: creating a reservation for a room with configured occupancy tiers changes the previewed and confirmed total when the guest count is changed, matching the amount the same room/dates/guest-count would show on the public booking page. Verified by the user against a local dev server; per-room guest count and price preview behaved correctly.

## 6. Fix pre-existing datepicker interaction bug found during verification

- [x] 6.1 Fix the check-in/check-out `<input type="date">` fields in `manual-reservation-form.tsx` closing their native picker on every month navigation. First made them uncontrolled (`defaultValue` instead of `value`), which was not sufficient: React's `onChange` for these inputs is driven by the native "input" event, which still fires on every intermediate step (e.g. each month-arrow press once the field already holds a complete date), continuing to trigger `updateDate` and its side effects mid-navigation. Fixed by replacing `onChange` with a native "change" event listener (`useCommittedDateChange`, attached via ref), which only fires once a date is actually committed (a day picked, or a complete value entered then blurred). Verified manually by the user: navigating months no longer closes the picker or triggers a reload. Existing date-related form tests still pass.
