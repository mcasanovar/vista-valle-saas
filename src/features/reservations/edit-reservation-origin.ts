import type { RoomLockGateway } from "@/features/availability";
import { createLodgingInterval } from "@/features/availability";

import {
  recalculateReservationStayPricing,
  type ReservationStayRoomRate,
} from "./edit-reservation-stay";
import {
  reconcileNightlyRatePayments,
  type ReservationNightlyRateFinancialSummary,
} from "./edit-reservation-nightly-rates";
import type { ReservationCharge } from "./pricing";
import { isExternalChannelOrigin } from "./reservation-rate-eligibility";
import {
  ReservationNotFoundError,
  type ReservationOrigin,
  type ReservationRecord,
  type ReservationRepository,
} from "./reservation-repository";

/**
 * Every origin a reservation can be attributed to. A correction may target any
 * of them, including `website`: the administrator asked for that explicitly,
 * with the caveat that relabelling a reservation a guest created on the site
 * moves where its payment is attributed in the monthly summary.
 */
export const correctableOrigins = [
  "website",
  "airbnb",
  "booking",
  "phone",
  "whatsapp",
  "admin",
] as const;

/** Thrown when the requested origin is not one of the six the system knows. */
export class InvalidReservationOriginError extends Error {
  readonly code = "INVALID_RESERVATION_ORIGIN" as const;
  readonly origin: string;

  constructor(origin: string) {
    super(
      `A reservation's origin can only be corrected to one of ${correctableOrigins.join(", ")}; received ${origin}`
    );
    this.name = "InvalidReservationOriginError";
    this.origin = origin;
  }
}

/** Narrows an untrusted origin value coming from a form submission. */
export function parseReservationOrigin(candidate: unknown): ReservationOrigin {
  if (
    typeof candidate !== "string" ||
    !(correctableOrigins as readonly string[]).includes(candidate)
  ) {
    throw new InvalidReservationOriginError(String(candidate));
  }
  return candidate as ReservationOrigin;
}

/**
 * Whether correcting a reservation to `nextOrigin` has to drop hand-set
 * nightly values. True only when the destination is not an external channel
 * *and* at least one line actually carries a hand-set value - so a correction
 * between two channels, or on a reservation priced from its rates, stays a
 * pure relabelling that touches no money.
 *
 * The UI uses this to warn before confirming; the server re-derives it.
 */
export function correctionDropsManualRates(
  reservation: Readonly<{ items: readonly Readonly<{ nightlyPriceManual: boolean }>[] }>,
  nextOrigin: ReservationOrigin
): boolean {
  if (isExternalChannelOrigin(nextOrigin)) return false;
  return reservation.items.some((item) => item.nightlyPriceManual);
}

export type EditReservationOriginInput = Readonly<{
  actorUserId?: string;
  origin: ReservationOrigin;
  reservationId: string;
}>;

export type EditReservationOriginParams<TContext> = Readonly<{
  chargesByRoom?: ReadonlyMap<string, readonly ReservationCharge[]>;
  /** Needed only when the correction drops hand-set values and the rooms must be repriced. */
  getRoomRates?: (
    roomIds: readonly string[]
  ) => Promise<ReadonlyMap<string, ReservationStayRoomRate>>;
  input: EditReservationOriginInput;
  reservationRepository: ReservationRepository<TContext>;
  roomLockGateway?: RoomLockGateway<TContext>;
}>;

export type EditReservationOriginResult = Readonly<{
  /** Present only when the correction dropped hand-set values and repriced the stay. */
  financialSummary?: ReservationNightlyRateFinancialSummary;
  reservation: ReservationRecord;
}>;

/**
 * Corrects which origin a reservation is attributed to, for a mistaken entry.
 * Any of the six origins is a valid target; status never restricts, and dates
 * and rooms are never touched.
 *
 * Two shapes, decided by `correctionDropsManualRates`:
 *
 * - **Pure relabelling** (destination is a channel, or no line carries a
 *   hand-set value): a single non-transactional update, like
 *   `editReservationInvoice`. No lock, no money touched.
 * - **Relabelling that drops hand-set values**: the rooms are repriced from
 *   their current occupancy rates, the total is recomputed and payments are
 *   reconciled with the same rule as a nightly-value edit (cancelled
 *   reservations still open no balance), and the origin plus that recalculation
 *   are written as one atomic operation - if the recalculation fails, the
 *   origin does not change either.
 */
export async function editReservationOrigin<TContext>(
  params: EditReservationOriginParams<TContext>
): Promise<EditReservationOriginResult> {
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

  const origin = parseReservationOrigin(input.origin);

  if (!correctionDropsManualRates(current, origin)) {
    if (!reservationRepository.updateReservationOrigin) {
      throw new Error(
        "This reservation repository does not support origin corrections"
      );
    }
    const reservation = await reservationRepository.updateReservationOrigin(
      input.reservationId,
      origin,
      input.actorUserId
    );
    return Object.freeze({ reservation });
  }

  // Dropping hand-set values means repricing, so both dependencies are required.
  if (!getRoomRates || !roomLockGateway) {
    throw new Error(
      "Correcting away from an external channel needs room rates and a lock gateway to reprice the stay"
    );
  }
  if (!reservationRepository.editReservationNightlyRates) {
    throw new Error(
      "Reservation repository does not support nightly rate edits"
    );
  }
  const editInRepository = reservationRepository.editReservationNightlyRates;

  const interval = createLodgingInterval(current.checkIn, current.checkOut);
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

  // No manual prices passed in: every room falls back to its current rate,
  // which is exactly "drop the hand-set values".
  const pricing = recalculateReservationStayPricing(
    interval,
    rooms,
    roomRatesById,
    chargesByRoom
  );
  const financialSummary = reconcileNightlyRatePayments(
    pricing.totalClp,
    approvedPaymentsClp,
    pendingPayment !== null,
    current.status
  );

  const reservation = await roomLockGateway.runLockedMany(
    [...roomIds].sort(),
    async (context) =>
      editInRepository(context, {
        actorUserId: input.actorUserId,
        approvedPaymentsClp: financialSummary.approvedPaymentsClp,
        items: pricing.items,
        // Written in the same transaction as the reprice, so a failure leaves
        // both the origin and the amounts untouched.
        origin,
        overpaymentClp: financialSummary.overpaymentClp,
        paymentAction: financialSummary.paymentAction,
        pendingPayAtPropertyPaymentId: pendingPayment?.id,
        previousOrigin: current.origin,
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
