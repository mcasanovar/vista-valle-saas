/**
 * Compatibility surface for the dates-only axis of a stay edit.
 *
 * The stay edit is now a single operation that covers dates, room set and
 * per-room occupancy: `./edit-reservation-stay.ts` holds the one
 * implementation of the recalculation and the item diff (design.md "Un
 * caso de uso único de estadía"). This module keeps the dates-only entry
 * point that existing callers still use - notably the AI assistant's
 * `editAdminReservationDatesWithResult` path - by delegating to it with
 * the reservation's current rooms left untouched.
 *
 * Nothing here re-implements any part of the edit. Do not add logic to
 * this file; add it to `./edit-reservation-stay.ts`.
 */
import {
  createLodgingInterval,
  type LodgingInterval,
} from "@/features/availability";

import type { ReservationCharge } from "./pricing";
import type { ReservationItemRecord } from "./reservation-repository";
import {
  editReservationStay,
  recalculateReservationStayPricing,
  type EditReservationStayParams,
  type EditReservationStayResult,
  type ReservationStayEditFinancialSummary,
  type ReservationStayRoomRate,
} from "./edit-reservation-stay";

export {
  assertReservationStayEditable as assertReservationDatesEditable,
  computeReservationStayEditFinancialSummary as computeReservationDateEditFinancialSummary,
  ReservationStayRoomRateMissingError as ReservationDateEditRoomRateMissingError,
} from "./edit-reservation-stay";

/** @deprecated Use `ReservationStayRoomRate` from `./edit-reservation-stay`. */
export type ReservationDateEditRoomRate = ReservationStayRoomRate;
/** @deprecated Use `ReservationStayEditFinancialSummary` from `./edit-reservation-stay`. */
export type ReservationDateEditFinancialSummary =
  ReservationStayEditFinancialSummary;
/** @deprecated Use `EditReservationStayResult` from `./edit-reservation-stay`. */
export type EditReservationDatesResult = EditReservationStayResult;

export type EditReservationDatesInput = Readonly<{
  /** Present only for an authenticated administrative edit audit. */
  actorUserId?: string;
  checkIn: string;
  checkOut: string;
  reservationId: string;
}>;

export type EditReservationDatesParams<TContext> = Omit<
  EditReservationStayParams<TContext>,
  "input"
> &
  Readonly<{ input: EditReservationDatesInput }>;

/**
 * Parses and validates the requested interval for a dates-only edit.
 * Throws `InvalidLodgingIntervalError` when `checkOut` is on or before
 * `checkIn` (spec "Intervalo inválido"). No minimum-date rule is applied:
 * an active reservation may keep a past `check-in`.
 */
export function parseRequestedEditInterval(input: EditReservationDatesInput) {
  return createLodgingInterval(input.checkIn, input.checkOut);
}

/**
 * Recomputes pricing for the rooms already on the reservation against a
 * new interval, keeping each item's persisted occupancy. A thin adapter
 * over `recalculateReservationStayPricing` for callers that only move the
 * dates.
 */
export function recalculateReservationDatesPricing(
  interval: LodgingInterval,
  items: readonly ReservationItemRecord[],
  roomRatesById: ReadonlyMap<string, ReservationStayRoomRate>,
  chargesByRoom: ReadonlyMap<string, readonly ReservationCharge[]> = new Map()
) {
  return recalculateReservationStayPricing(
    interval,
    items.map((item) =>
      Object.freeze({ guestCount: item.guestCount, roomId: item.roomId })
    ),
    roomRatesById,
    chargesByRoom
  );
}

/**
 * Edits only a reservation's dates, leaving its rooms and occupancy as
 * persisted. Delegates to `editReservationStay` by omitting the rooms
 * axis, so both axes share one transaction, one recalculation, one audit
 * event and one notification.
 */
export async function editReservationDates<TContext>(
  params: EditReservationDatesParams<TContext>
): Promise<EditReservationStayResult> {
  const { input, ...rest } = params;
  return editReservationStay({
    ...rest,
    input: {
      actorUserId: input.actorUserId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      reservationId: input.reservationId,
    },
  });
}
