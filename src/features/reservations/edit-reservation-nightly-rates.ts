import type { LodgingInterval, RoomLockGateway } from "@/features/availability";
import { createLodgingInterval } from "@/features/availability";
import type { RoomOccupancyPrice } from "@/features/rooms";

import {
  computeReservationStayEditFinancialSummary,
  recalculateReservationStayPricing,
  type ReservationStayEditFinancialSummary,
  type ReservationStayRoomRate,
} from "./edit-reservation-stay";
import type { ReservationCharge } from "./pricing";
import { assertExternalChannelReservation } from "./reservation-rate-eligibility";
import {
  ReservationNotFoundError,
  type ReservationDateEditPaymentAction,
  type ReservationRecord,
  type ReservationRepository,
} from "./reservation-repository";

/**
 * One requested nightly-value change. `nightlyPriceClp: null` drops the
 * hand-set value and returns the room to its current occupancy rate - the
 * same operation with the value absent, not a separate endpoint (design.md
 * decision 4).
 */
export type ReservationNightlyRateOverride = Readonly<{
  nightlyPriceClp: number | null;
  roomId: string;
}>;

export type EditReservationNightlyRatesInput = Readonly<{
  /** Present only for an authenticated administrative edit audit. */
  actorUserId?: string;
  /** The requested changes. A room absent from this list keeps whatever it has, hand-set or resolved. */
  overrides: readonly ReservationNightlyRateOverride[];
  reservationId: string;
}>;

/** Thrown when a requested nightly value is not a positive integer amount of CLP. */
export class InvalidNightlyRateError extends RangeError {
  readonly code = "INVALID_NIGHTLY_RATE" as const;
  readonly nightlyPriceClp: number;
  readonly roomId: string;

  constructor(roomId: string, nightlyPriceClp: number) {
    super(
      `Nightly value for room ${roomId} must be a positive whole amount of CLP; received ${nightlyPriceClp}`
    );
    this.name = "InvalidNightlyRateError";
    this.nightlyPriceClp = nightlyPriceClp;
    this.roomId = roomId;
  }
}

/** Thrown when a requested room is not part of the reservation. */
export class ReservationRoomNotInStayError extends Error {
  readonly code = "RESERVATION_ROOM_NOT_IN_STAY" as const;
  readonly roomId: string;

  constructor(roomId: string) {
    super(`Room ${roomId} is not part of this reservation`);
    this.name = "ReservationRoomNotInStayError";
    this.roomId = roomId;
  }
}

/**
 * Validates every requested value before anything is priced or written. The
 * DB check `reservation_items_nightly_price_positive` already demands a
 * positive amount; this rejects it earlier so the administrator gets a
 * business reason instead of a constraint violation.
 */
export function assertValidNightlyRateOverrides(
  overrides: readonly ReservationNightlyRateOverride[],
  current: ReservationRecord
): void {
  const stayRoomIds = new Set(current.items.map((item) => item.roomId));
  for (const override of overrides) {
    if (!stayRoomIds.has(override.roomId)) {
      throw new ReservationRoomNotInStayError(override.roomId);
    }
    if (override.nightlyPriceClp === null) continue;
    if (
      !Number.isSafeInteger(override.nightlyPriceClp) ||
      override.nightlyPriceClp <= 0
    ) {
      throw new InvalidNightlyRateError(
        override.roomId,
        override.nightlyPriceClp
      );
    }
  }
}

/**
 * Merges the requested overrides onto the reservation's persisted hand-set
 * values, producing the map `recalculateReservationStayPricing` consumes. A
 * requested `null` removes the room from the map, so it falls back to the
 * room's current occupancy rate; a room not mentioned keeps what it had.
 */
export function mergeNightlyRateOverrides(
  current: ReservationRecord,
  overrides: readonly ReservationNightlyRateOverride[]
): ReadonlyMap<string, number> {
  const merged = new Map<string, number>(
    current.items
      .filter((item) => item.nightlyPriceManual)
      .map((item) => [item.roomId, item.nightlyPriceClp] as const)
  );
  for (const override of overrides) {
    if (override.nightlyPriceClp === null) merged.delete(override.roomId);
    else merged.set(override.roomId, override.nightlyPriceClp);
  }
  return merged;
}

/**
 * The financial outcome for a nightly-value edit. Identical to a stay edit's
 * summary except for cancelled reservations, where no new balance is ever
 * opened: see `reconcileNightlyRatePayments`.
 */
export type ReservationNightlyRateFinancialSummary =
  ReservationStayEditFinancialSummary;

/**
 * Reconciles payments for a nightly-value edit.
 *
 * For every live status this is exactly a stay edit's reconciliation
 * (approved payments untouched; the open pending balance set to the
 * shortfall, cancelled when there is none; an overpayment recorded for
 * manual resolution). A **cancelled** reservation is the one exception: its
 * payments were already cancelled when it was cancelled, and editing its
 * value is a bookkeeping correction that no one will collect, so no pending
 * balance is opened and `paymentAction` is forced to `"none"` - or to
 * `"cancel_pending"` if a pending row somehow survives, which is a
 * reduction, never a new charge.
 *
 * `overpaymentClp` and `approvedPaymentsClp` are still reported for the
 * audit event, so a cancelled reservation's edit stays fully traceable.
 */
export function reconcileNightlyRatePayments(
  newTotalClp: number,
  approvedPaymentsClp: number,
  hasExistingPendingPayment: boolean,
  status: ReservationRecord["status"]
): ReservationNightlyRateFinancialSummary {
  const summary = computeReservationStayEditFinancialSummary(
    newTotalClp,
    approvedPaymentsClp,
    hasExistingPendingPayment
  );
  if (status !== "cancelled") return summary;

  const paymentAction: ReservationDateEditPaymentAction =
    hasExistingPendingPayment ? { type: "cancel_pending" } : { type: "none" };
  return Object.freeze({ ...summary, paymentAction });
}

/** The current rate data for one room, needed to re-resolve a dropped override. */
export type ReservationNightlyRateRoomRate = ReservationStayRoomRate;

export type { RoomOccupancyPrice };

export type EditReservationNightlyRatesParams<TContext> = Readonly<{
  chargesByRoom?: ReadonlyMap<string, readonly ReservationCharge[]>;
  getRoomRates: (
    roomIds: readonly string[]
  ) => Promise<ReadonlyMap<string, ReservationNightlyRateRoomRate>>;
  input: EditReservationNightlyRatesInput;
  reservationRepository: ReservationRepository<TContext>;
  roomLockGateway: RoomLockGateway<TContext>;
}>;

export type EditReservationNightlyRatesResult = Readonly<{
  financialSummary: ReservationNightlyRateFinancialSummary;
  reservation: ReservationRecord;
}>;

/**
 * The transactional entry point for setting, changing or dropping the
 * nightly value of an external-channel reservation's rooms.
 *
 * Re-reads the reservation, asserts its origin is `airbnb` or `booking`
 * (status never restricts), validates the requested values, recalculates
 * every line and the total over the reservation's *current* interval and
 * rooms, reconciles payments, and writes lines, payments and audit as one
 * atomic operation.
 *
 * Uses `runLockedMany` rather than `runExclusiveMany`: the value does not
 * move dates or rooms, so there is no occupancy to revalidate - only
 * atomicity and a row lock are needed (design.md decision 3).
 *
 * Any failure leaves the reservation's lines, total and payments untouched.
 */
export async function editReservationNightlyRates<TContext>(
  params: EditReservationNightlyRatesParams<TContext>
): Promise<EditReservationNightlyRatesResult> {
  const {
    chargesByRoom,
    getRoomRates,
    input,
    reservationRepository,
    roomLockGateway,
  } = params;

  const current = await reservationRepository.getReservationById(
    input.reservationId
  );
  if (!current) throw new ReservationNotFoundError(input.reservationId);

  assertExternalChannelReservation(current);
  assertValidNightlyRateOverrides(input.overrides, current);

  const interval: LodgingInterval = createLodgingInterval(
    current.checkIn,
    current.checkOut
  );
  const rooms = current.items.map((item) =>
    Object.freeze({ guestCount: item.guestCount, roomId: item.roomId })
  );
  const roomIds = rooms.map((room) => room.roomId);

  const [roomRatesById, approvedPaymentsClp, pendingPayment] =
    await Promise.all([
      getRoomRates(roomIds),
      reservationRepository.getApprovedPaymentsTotalClp?.(current.id) ??
        Promise.resolve(0),
      reservationRepository.getPendingPayAtPropertyPaymentByReservationId?.(
        current.id
      ) ?? Promise.resolve(null),
    ]);

  const pricing = recalculateReservationStayPricing(
    interval,
    rooms,
    roomRatesById,
    chargesByRoom,
    mergeNightlyRateOverrides(current, input.overrides)
  );

  const financialSummary = reconcileNightlyRatePayments(
    pricing.totalClp,
    approvedPaymentsClp,
    pendingPayment !== null,
    current.status
  );

  if (!reservationRepository.editReservationNightlyRates) {
    throw new Error(
      "Reservation repository does not support nightly rate edits"
    );
  }
  const editInRepository = reservationRepository.editReservationNightlyRates;

  const reservation = await roomLockGateway.runLockedMany(
    [...roomIds].sort(),
    async (context) =>
      editInRepository(context, {
        actorUserId: input.actorUserId,
        approvedPaymentsClp: financialSummary.approvedPaymentsClp,
        items: pricing.items,
        overpaymentClp: financialSummary.overpaymentClp,
        paymentAction: financialSummary.paymentAction,
        pendingPayAtPropertyPaymentId: pendingPayment?.id,
        // Captured pre-edit: the only source for what each line held before.
        previousRates: Object.freeze(
          current.items.map((item) =>
            Object.freeze({
              nightlyPriceClp: item.nightlyPriceClp,
              nightlyPriceManual: item.nightlyPriceManual,
              roomId: item.roomId,
            })
          )
        ),
        previousTotalClp: current.totalClp,
        reservationId: current.id,
      })
  );

  return Object.freeze({ financialSummary, reservation });
}
