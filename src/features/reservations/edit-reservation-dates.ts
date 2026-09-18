import {
  createLodgingInterval,
  type LodgingInterval,
  type RoomLockGateway,
} from "@/features/availability";
import type { NotificationOutboxWriter } from "@/features/notifications";
import {
  resolveRoomNightlyPrice,
  type RoomOccupancyPrice,
} from "@/features/rooms";

import {
  computeMultiRoomReservationPricing,
  type MultiRoomReservationPricingResult,
  type ReservationCharge,
} from "./pricing";
import {
  ReservationNotFoundError,
  type ReservationDateEditPaymentAction,
  type ReservationItemRecord,
  type ReservationRecord,
  type ReservationRepository,
} from "./reservation-repository";

/**
 * Single point of truth for date-edit eligibility, kept as an explicit
 * function (rather than removed) so both the UI gate and the server
 * transaction keep sharing one call site if a future eligibility rule is
 * ever needed. Every reservation is eligible today, regardless of origin
 * (`website`, `phone`, `whatsapp`, `admin`, `airbnb`, `booking`) or status
 * (`confirmed`, `cancelled`, `completed`, `no_show`); editing dates never
 * changes the reservation's status.
 */
export function assertReservationDatesEditable(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept as the shared eligibility call site (design.md decision 1); every reservation currently passes.
  reservation: ReservationRecord
): void {
  // No restrictions: every reservation is eligible for a date edit.
}

export type EditReservationDatesInput = Readonly<{
  /** Present only for an authenticated administrative edit audit. */
  actorUserId?: string;
  checkIn: string;
  checkOut: string;
  reservationId: string;
}>;

/**
 * Parses and validates the requested interval for a date edit. Throws
 * `InvalidLodgingIntervalError` (re-exported from `@/features/availability`)
 * when `checkOut` is on or before `checkIn` (spec "Intervalo inválido").
 * Unlike the public search flow, no minimum-date rule is applied here: an
 * active reservation may keep a past `check-in` while its stay is extended
 * (design.md decision 4).
 */
export function parseRequestedEditInterval(
  input: EditReservationDatesInput
): LodgingInterval {
  return createLodgingInterval(input.checkIn, input.checkOut);
}

/** The current, authoritative rate data this module needs for one room; a narrow projection of `RoomReadModel`. */
export type ReservationDateEditRoomRate = Readonly<{
  capacity: number;
  id: string;
  nightlyPriceClp: number;
  occupancyPrices: readonly RoomOccupancyPrice[];
}>;

/**
 * Thrown when the current rate for one of the reservation's rooms could not
 * be found (e.g. the room was deleted after the reservation was created).
 */
export class ReservationDateEditRoomRateMissingError extends Error {
  readonly code = "RESERVATION_DATE_EDIT_ROOM_RATE_MISSING" as const;
  readonly roomId: string;

  constructor(roomId: string) {
    super(`No current rate found for room ${roomId}`);
    this.name = "ReservationDateEditRoomRateMissingError";
    this.roomId = roomId;
  }
}

/**
 * Recomputes noches, tarifa vigente, cargos y total for every room already
 * on the reservation against the newly requested interval (design.md
 * decision 2). Each room keeps the `guestCount` already persisted on its
 * item - the edit never changes occupancy - and its nightly price is
 * re-resolved from the room's *current* rate (including per-occupancy
 * pricing), not the price frozen when the reservation was created. Nothing
 * here accepts a caller-supplied price or total; the only inputs are the
 * new dates, the persisted items, and the current room rates.
 */
export function recalculateReservationDatesPricing(
  interval: LodgingInterval,
  items: readonly ReservationItemRecord[],
  roomRatesById: ReadonlyMap<string, ReservationDateEditRoomRate>,
  chargesByRoom: ReadonlyMap<string, readonly ReservationCharge[]> = new Map()
): MultiRoomReservationPricingResult {
  const rooms = items.map((item) => {
    const rate = roomRatesById.get(item.roomId);
    if (!rate) throw new ReservationDateEditRoomRateMissingError(item.roomId);
    return Object.freeze({
      guestCount: item.guestCount,
      id: item.roomId,
      nightlyPriceClp: resolveRoomNightlyPrice(
        rate,
        rate.occupancyPrices,
        item.guestCount
      ),
    });
  });

  return computeMultiRoomReservationPricing(interval, rooms, chargesByRoom);
}

/**
 * The financial outcome of a date edit (design.md decision 3): approved
 * payments are always kept as-is; only the reservation's single open
 * `pay_at_property` pending balance is targeted. `pendingBalanceClp` is
 * `max(newTotalClp - approvedPaymentsClp, 0)`; `overpaymentClp` is the
 * opposite excess, surfaced for manual resolution and never refunded
 * automatically.
 */
export type ReservationDateEditFinancialSummary = Readonly<{
  approvedPaymentsClp: number;
  overpaymentClp: number;
  paymentAction: ReservationDateEditPaymentAction;
  pendingBalanceClp: number;
}>;

/**
 * Pure financial calculation for a date edit. The server never trusts a
 * caller-supplied paid amount, balance, or difference (spec "Cálculo
 * contra importes manipulados"): the only inputs are the recalculated
 * total, the persisted sum of approved payments, and whether a pending
 * `pay_at_property` payment currently exists.
 */
export function computeReservationDateEditFinancialSummary(
  newTotalClp: number,
  approvedPaymentsClp: number,
  hasExistingPendingPayment: boolean
): ReservationDateEditFinancialSummary {
  const pendingBalanceClp = Math.max(newTotalClp - approvedPaymentsClp, 0);
  const overpaymentClp = Math.max(approvedPaymentsClp - newTotalClp, 0);
  const paymentAction: ReservationDateEditPaymentAction =
    pendingBalanceClp > 0
      ? { type: "set_pending", amountClp: pendingBalanceClp }
      : hasExistingPendingPayment
        ? { type: "cancel_pending" }
        : { type: "none" };

  return Object.freeze({
    approvedPaymentsClp,
    overpaymentClp,
    paymentAction,
    pendingBalanceClp,
  });
}

export type EditReservationDatesParams<TContext> = Readonly<{
  chargesByRoom?: ReadonlyMap<string, readonly ReservationCharge[]>;
  getRoomRates: (
    roomIds: readonly string[]
  ) => Promise<ReadonlyMap<string, ReservationDateEditRoomRate>>;
  input: EditReservationDatesInput;
  /** Enqueues the idempotent "dates changed" notification in the same transaction (design.md decision 5); omit to skip notifying. */
  notificationOutboxWriter?: NotificationOutboxWriter<TContext>;
  reservationRepository: ReservationRepository<TContext>;
  roomLockGateway: RoomLockGateway<TContext>;
}>;

/**
 * The single transactional entry point for editing a reservation's stay
 * dates (design.md decision 1). Re-reads the reservation, recalculates
 * pricing from the requested interval and each room's current rate, then
 * locks every room the reservation occupies in stable order and
 * revalidates availability - excluding the reservation's own current
 * occupancy - before updating its header and items as one atomic
 * operation. Any failure (invalid interval, missing rate, or a room-lock
 * conflict) leaves the reservation's dates, prices, and availability
 * untouched.
 */
export type EditReservationDatesResult = Readonly<{
  financialSummary: ReservationDateEditFinancialSummary;
  reservation: ReservationRecord;
}>;

export async function editReservationDates<TContext>(
  params: EditReservationDatesParams<TContext>
): Promise<EditReservationDatesResult> {
  const {
    chargesByRoom,
    getRoomRates,
    input,
    notificationOutboxWriter,
    reservationRepository,
    roomLockGateway,
  } = params;

  const current = await reservationRepository.getReservationById(
    input.reservationId
  );
  if (!current) throw new ReservationNotFoundError(input.reservationId);

  assertReservationDatesEditable(current);

  const interval = parseRequestedEditInterval(input);
  const roomIds = current.items.map((item) => item.roomId);
  const [roomRatesById, approvedPaymentsClp, pendingPayment] =
    await Promise.all([
      getRoomRates(roomIds),
      reservationRepository.getApprovedPaymentsTotalClp?.(current.id) ??
        Promise.resolve(0),
      reservationRepository.getPendingPayAtPropertyPaymentByReservationId?.(
        current.id
      ) ?? Promise.resolve(null),
    ]);
  const pricing = recalculateReservationDatesPricing(
    interval,
    current.items,
    roomRatesById,
    chargesByRoom
  );
  const financialSummary = computeReservationDateEditFinancialSummary(
    pricing.totalClp,
    approvedPaymentsClp,
    pendingPayment !== null
  );

  if (!reservationRepository.editReservationDates) {
    throw new Error("Reservation repository does not support date edits");
  }
  const editReservationDatesInRepository =
    reservationRepository.editReservationDates;

  const reservation = await roomLockGateway.runExclusiveMany(
    roomIds,
    interval,
    async (context) => {
      const updated = await editReservationDatesInRepository(context, {
        actorUserId: input.actorUserId,
        approvedPaymentsClp: financialSummary.approvedPaymentsClp,
        checkIn: interval.checkIn,
        checkOut: interval.checkOut,
        items: pricing.items,
        overpaymentClp: financialSummary.overpaymentClp,
        paymentAction: financialSummary.paymentAction,
        pendingPayAtPropertyPaymentId: pendingPayment?.id,
        reservationId: current.id,
      });
      await notificationOutboxWriter?.writeReservationDatesChanged(context, {
        reservation: updated,
      });
      return updated;
    },
    { excludeReservationId: current.id }
  );

  return Object.freeze({ financialSummary, reservation });
}
