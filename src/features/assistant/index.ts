// Public API boundary for the assistant capability. Exports are added with its implementation.
//
// Readiness of the domain cores this feature will wrap in tools (tasks 1.1-1.5):
// typed-invocable today means importable through another feature's own
// `index.ts` barrel, per the `architecture/feature-public-api` ESLint rule —
// a deep import (e.g. `@/features/admin/manual-reservation`) is rejected.
//
// Already typed-invocable via their feature's barrel:
// - `searchAvailability` — `@/features/availability`
// - `createRoomBlocks`, `removeRoomBlock`, `listRoomBlocks` — `@/features/room-blocks`
// - `editReservationDates`, `transitionReservationState` — `@/features/reservations`
//
// Typed but NOT YET invocable cross-feature: `src/features/admin/` has no
// `index.ts` barrel, so none of its exports — including the typed cores
// added for this change (`createManualReservationFromInput`,
// `transitionAdminReservationWithResult`, `markPaymentPaidWithResult`,
// `collectPayAtPropertyWithResult`, `getAdminDashboardSummary`) — can be
// imported from here yet. A barrel will be added to `src/features/admin/`
// exposing exactly what each tool needs as those tools are implemented
// (sections 5-6).
export {};
