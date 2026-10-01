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
  type ReservationRecord,
  type ReservationRepository,
} from "./reservation-repository";

/**
 * Single point of truth for stay-edit eligibility, kept as an explicit
 * function so both the UI gate and the server transaction share one call
 * site if a future eligibility rule is ever needed. Every reservation is
 * eligible today, regardless of origin (`website`, `phone`, `whatsapp`,
 * `admin`, `airbnb`, `booking`) or status (`confirmed`, `cancelled`,
 * `completed`, `no_show`); editing the stay never changes the status.
 *
 * Keeping every status eligible is a deliberate decision (design.md
 * "Elegibilidad de cualquier estado, con su consecuencia registrada"):
 * because occupancy only counts `confirmed` reservations, editing a
 * cancelled reservation passes the availability check trivially.
 */
export function assertReservationStayEditable(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept as the shared eligibility call site; every reservation currently passes.
  reservation: ReservationRecord
): void {
  // No restrictions: every reservation is eligible for a stay edit.
}

/** One requested room line: the room and the occupancy asked for it. */
export type ReservationStayRoomSelection = Readonly<{
  guestCount: number;
  roomId: string;
}>;

/**
 * A requested stay edit. Both axes are optional and independent: omitting
 * `checkIn`/`checkOut` keeps the reservation's current interval, and
 * omitting `items` keeps its current rooms and occupancy. `items` is the
 * complete requested set, so a room missing from it is removed and a room
 * new to it is added.
 */
export type EditReservationStayInput = Readonly<{
  /** Present only for an authenticated administrative edit audit. */
  actorUserId?: string;
  checkIn?: string;
  checkOut?: string;
  items?: readonly ReservationStayRoomSelection[];
  reservationId: string;
}>;

/**
 * Parses and validates the requested interval for a stay edit, falling
 * back to the reservation's persisted interval when the caller does not
 * move the dates. Throws `InvalidLodgingIntervalError` (re-exported from
 * `@/features/availability`) when `checkOut` is on or before `checkIn`
 * (spec "Intervalo inválido"). Unlike the public search flow, no
 * minimum-date rule is applied here: an active reservation may keep a past
 * `check-in` while its stay is edited.
 */
export function parseRequestedStayInterval(
  input: EditReservationStayInput,
  current: ReservationRecord
): LodgingInterval {
  return createLodgingInterval(
    input.checkIn ?? current.checkIn,
    input.checkOut ?? current.checkOut
  );
}

/**
 * Resolves the requested room set, defaulting to the reservation's
 * persisted items when the caller does not touch the rooms axis.
 */
export function resolveRequestedStayRooms(
  input: EditReservationStayInput,
  current: ReservationRecord
): readonly ReservationStayRoomSelection[] {
  if (!input.items) {
    return Object.freeze(
      current.items.map((item) =>
        Object.freeze({ guestCount: item.guestCount, roomId: item.roomId })
      )
    );
  }
  return Object.freeze(input.items.map((item) => Object.freeze({ ...item })));
}

/** The current, authoritative rate data this module needs for one room; a narrow projection of `RoomReadModel`. */
export type ReservationStayRoomRate = Readonly<{
  capacity: number;
  id: string;
  nightlyPriceClp: number;
  occupancyPrices: readonly RoomOccupancyPrice[];
}>;

/**
 * Thrown when the current rate for one of the requested rooms could not be
 * found (e.g. the room was deleted after the reservation was created).
 * Only requested rooms need a rate: a room being *removed* from the stay
 * never needs one, so an edit can drop a room that no longer exists.
 */
export class ReservationStayRoomRateMissingError extends Error {
  readonly code = "RESERVATION_STAY_ROOM_RATE_MISSING" as const;
  readonly roomId: string;

  constructor(roomId: string) {
    super(`No current rate found for room ${roomId}`);
    this.name = "ReservationStayRoomRateMissingError";
    this.roomId = roomId;
  }
}

/**
 * Thrown when the edit would leave the reservation with no rooms. Checked
 * *before* pricing is computed so the caller gets this explicit reason
 * instead of `InvalidPricingInputError` from `computeMultiRoomReservationPricing`,
 * which stays in place as the domain's safety net (design.md "La estadía
 * vacía se rechaza antes de llegar al cálculo de precio").
 */
export class ReservationStayRequiresRoomError extends Error {
  readonly code = "RESERVATION_STAY_REQUIRES_ROOM" as const;

  constructor() {
    super("A reservation must keep at least one room");
    this.name = "ReservationStayRequiresRoomError";
  }
}

/** Thrown when the requested occupancy does not fit a room's capacity. */
export class ReservationStayRoomCapacityExceededError extends Error {
  readonly capacity: number;
  readonly code = "RESERVATION_STAY_ROOM_CAPACITY_EXCEEDED" as const;
  readonly guestCount: number;
  readonly roomId: string;

  constructor(roomId: string, guestCount: number, capacity: number) {
    super(
      `Room ${roomId} holds ${capacity} guests; ${guestCount} were requested`
    );
    this.name = "ReservationStayRoomCapacityExceededError";
    this.capacity = capacity;
    this.guestCount = guestCount;
    this.roomId = roomId;
  }
}

/**
 * Validates every requested room line against the room's current
 * capacity, using the same criterion as `selectedRooms` in
 * `./room-selection.ts` (at least one guest, never more than the room
 * holds). Where the public booking path silently drops an out-of-range
 * selection, an administrative edit rejects it explicitly so the
 * administrator learns why nothing changed.
 */
export function assertRequestedOccupancyFits(
  rooms: readonly ReservationStayRoomSelection[],
  roomRatesById: ReadonlyMap<string, ReservationStayRoomRate>
): void {
  for (const room of rooms) {
    const rate = roomRatesById.get(room.roomId);
    if (!rate) throw new ReservationStayRoomRateMissingError(room.roomId);
    if (
      !Number.isSafeInteger(room.guestCount) ||
      room.guestCount < 1 ||
      room.guestCount > rate.capacity
    ) {
      throw new ReservationStayRoomCapacityExceededError(
        room.roomId,
        room.guestCount,
        rate.capacity
      );
    }
  }
}

/**
 * Recomputes noches, tarifa vigente por ocupación, cargos y total for the
 * requested stay. Each room's nightly price is re-resolved from the room's
 * *current* rate for the *requested* occupancy, not the price frozen when
 * the reservation was created, so changing only the guest count of a room
 * changes its subtotal. Nothing here accepts a caller-supplied price or
 * total; the only inputs are the interval, the requested room lines, and
 * the current room rates.
 */
export function recalculateReservationStayPricing(
  interval: LodgingInterval,
  rooms: readonly ReservationStayRoomSelection[],
  roomRatesById: ReadonlyMap<string, ReservationStayRoomRate>,
  chargesByRoom: ReadonlyMap<string, readonly ReservationCharge[]> = new Map()
): MultiRoomReservationPricingResult {
  const priced = rooms.map((room) => {
    const rate = roomRatesById.get(room.roomId);
    if (!rate) throw new ReservationStayRoomRateMissingError(room.roomId);
    return Object.freeze({
      guestCount: room.guestCount,
      id: room.roomId,
      nightlyPriceClp: resolveRoomNightlyPrice(
        rate,
        rate.occupancyPrices,
        room.guestCount
      ),
    });
  });

  return computeMultiRoomReservationPricing(interval, priced, chargesByRoom);
}

/**
 * The financial outcome of a stay edit: approved payments are always kept
 * as-is; only the reservation's single open `pay_at_property` pending
 * balance is targeted. `pendingBalanceClp` is
 * `max(newTotalClp - approvedPaymentsClp, 0)`; `overpaymentClp` is the
 * opposite excess, surfaced for manual resolution and never refunded
 * automatically. Reached identically whether the total moved because of
 * the dates, the rooms, or the occupancy.
 */
export type ReservationStayEditFinancialSummary = Readonly<{
  approvedPaymentsClp: number;
  overpaymentClp: number;
  paymentAction: ReservationDateEditPaymentAction;
  pendingBalanceClp: number;
}>;

/**
 * Pure financial calculation for a stay edit. The server never trusts a
 * caller-supplied paid amount, balance, or difference: the only inputs are
 * the recalculated total, the persisted sum of approved payments, and
 * whether a pending `pay_at_property` payment currently exists.
 */
export function computeReservationStayEditFinancialSummary(
  newTotalClp: number,
  approvedPaymentsClp: number,
  hasExistingPendingPayment: boolean
): ReservationStayEditFinancialSummary {
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

/**
 * The room ids to lock for a stay edit: the union of the rooms the
 * reservation currently occupies and the rooms it will occupy, in stable
 * sorted order.
 *
 * The outgoing room is included on purpose. `runExclusiveMany` checks
 * availability for every room it receives, including the one about to be
 * freed, and that check is a deliberate no-op: in this interval the
 * outgoing room is occupied only by this same reservation, which
 * `excludeReservationId` removes from the overlap calculation. Do not
 * "optimize" it away - locking the union is what keeps a concurrent
 * reservation from taking an incoming room between the availability check
 * and the write.
 */
export function stayEditLockRoomIds(
  current: Readonly<{ items: readonly Readonly<{ roomId: string }>[] }>,
  requested: readonly ReservationStayRoomSelection[]
): readonly string[] {
  return Object.freeze(
    [
      ...new Set([
        ...current.items.map((item) => item.roomId),
        ...requested.map((room) => room.roomId),
      ]),
    ].sort()
  );
}

export type EditReservationStayParams<TContext> = Readonly<{
  chargesByRoom?: ReadonlyMap<string, readonly ReservationCharge[]>;
  getRoomRates: (
    roomIds: readonly string[]
  ) => Promise<ReadonlyMap<string, ReservationStayRoomRate>>;
  input: EditReservationStayInput;
  /** Enqueues the idempotent "stay changed" notification in the same transaction; omit to skip notifying. */
  notificationOutboxWriter?: NotificationOutboxWriter<TContext>;
  reservationRepository: ReservationRepository<TContext>;
  roomLockGateway: RoomLockGateway<TContext>;
}>;

export type EditReservationStayResult = Readonly<{
  financialSummary: ReservationStayEditFinancialSummary;
  reservation: ReservationRecord;
}>;

/**
 * The single transactional entry point for editing a reservation's stay -
 * dates, room set, and per-room occupancy - in one operation (design.md
 * "Un caso de uso único de estadía"). Re-reads the reservation, resolves
 * the requested interval and room set (each falling back to what is
 * persisted), validates occupancy against current capacity, recalculates
 * pricing from each requested room's current rate, then locks the union of
 * current and requested rooms in stable order and revalidates availability
 * - excluding the reservation's own occupancy - before writing its header,
 * its whole item set, its payment reconciliation, and its audit event as
 * one atomic operation.
 *
 * Any failure (invalid interval, empty stay, capacity, missing rate, or a
 * room-lock conflict) leaves the reservation's dates, rooms, occupancy,
 * prices, and availability untouched.
 */
export async function editReservationStay<TContext>(
  params: EditReservationStayParams<TContext>
): Promise<EditReservationStayResult> {
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

  assertReservationStayEditable(current);

  const interval = parseRequestedStayInterval(input, current);
  const requestedRooms = resolveRequestedStayRooms(input, current);
  // Checked before pricing so an empty stay reports its own reason.
  if (requestedRooms.length === 0) throw new ReservationStayRequiresRoomError();

  const requestedRoomIds = requestedRooms.map((room) => room.roomId);
  const [roomRatesById, approvedPaymentsClp, pendingPayment] =
    await Promise.all([
      getRoomRates(requestedRoomIds),
      reservationRepository.getApprovedPaymentsTotalClp?.(current.id) ??
        Promise.resolve(0),
      reservationRepository.getPendingPayAtPropertyPaymentByReservationId?.(
        current.id
      ) ?? Promise.resolve(null),
    ]);

  assertRequestedOccupancyFits(requestedRooms, roomRatesById);

  const pricing = recalculateReservationStayPricing(
    interval,
    requestedRooms,
    roomRatesById,
    chargesByRoom
  );
  const financialSummary = computeReservationStayEditFinancialSummary(
    pricing.totalClp,
    approvedPaymentsClp,
    pendingPayment !== null
  );

  if (!reservationRepository.editReservationStay) {
    throw new Error("Reservation repository does not support stay edits");
  }
  const editReservationStayInRepository =
    reservationRepository.editReservationStay;

  const reservation = await roomLockGateway.runExclusiveMany(
    stayEditLockRoomIds(current, requestedRooms),
    interval,
    async (context) => {
      const updated = await editReservationStayInRepository(context, {
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
        // Captured from the pre-edit record: the only source for the rooms
        // this edit removes, which `updated` no longer carries.
        previousStay: {
          checkIn: current.checkIn,
          checkOut: current.checkOut,
          rooms: current.items.map((item) => ({
            guestCount: item.guestCount,
            roomId: item.roomId,
          })),
        },
        reservation: updated,
      });
      return updated;
    },
    { excludeReservationId: current.id }
  );

  return Object.freeze({ financialSummary, reservation });
}
