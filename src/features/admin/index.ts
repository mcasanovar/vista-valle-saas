// Public API boundary for the admin capability. Exports are added as other
// features need them — see `src/features/assistant/index.ts` for the
// readiness notes this barrel is filling in.
export {
  getAdminDashboardSummary,
  resolveAdminDashboardPeriod,
  type AdminDashboardPeriod,
  type AdminDashboardSummary,
} from "./dashboard";
export {
  createManualReservationFromInputResolved,
  manualOrigins,
  type ManualOrigin,
  type ManualReservationInput,
  type ManualReservationInvoiceInput,
  type ManualReservationRoomSelection,
} from "./manual-reservation";
export {
  editAdminReservationDatesWithResult,
  type EditReservationDatesActionResult,
} from "./edit-reservation-dates-action";
export {
  transitionAdminReservationWithResult,
  type AdminReservationTransition,
  type TransitionAdminReservationResult,
} from "./reservation-actions";
export {
  markPaymentPaidWithResult,
  type MarkPaymentPaidResult,
} from "./mark-payment-paid-action";
export {
  collectPayAtPropertyWithResult,
  type CollectPayAtPropertyInput,
  type CollectPayAtPropertyResult,
} from "./pay-at-property-admin-collect-action";
