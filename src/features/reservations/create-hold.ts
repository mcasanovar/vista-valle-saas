import type { LodgingInterval, RoomLockGateway } from "@/features/availability";
import type { RoomReadModel } from "@/features/rooms";

import { assertGuestCountWithinCapacity } from "./capacity";
import type { GuestRepository } from "./guest-repository";
import { parseGuestInput } from "./guest";
import type {
  CreateHoldInput,
  HoldRepository,
  ReservationHoldRecord,
} from "./hold-repository";
import { computeMultiRoomReservationPricing, type ReservationCharge } from "./pricing";

/**
 * Same shape as `CreatePayAtPropertyReservationRoom`: `nightlyPriceClp`
 * MUST already be resolved for this room's chosen occupancy (see
 * `resolveRoomNightlyPrice`) by the caller — this function does not
 * re-resolve it, matching `createMultiRoomPayAtPropertyReservation`.
 */
export type CreatePaymentHoldRoom = Pick<
  RoomReadModel,
  "capacity" | "id" | "nightlyPriceClp"
> &
  Readonly<{
    /** Guests assigned to this specific room; defaults to 1 (see `room-occupancy-pricing` spec). */
    guestCount?: number;
  }>;

/**
 * Everything `createPaymentHold` needs. `TContext` is inferred from
 * `roomLockGateway`, and `guestRepository`/`holdRepository` MUST share the
 * exact same `TContext` so the same context/transaction handed to them by
 * `RoomLockGateway.runExclusiveMany` threads through unchanged (see
 * `./guest-repository.ts` and `./hold-repository.ts`).
 */
export type CreatePaymentHoldParams<TContext> = Readonly<{
  /** Applicable extra charges per room, defaulting to none (Vista Valle has no configured charges for the MVP). */
  chargesByRoom?: ReadonlyMap<string, readonly ReservationCharge[]>;
  /** Raw, untrusted guest booking input; validated by `parseGuestInput`. */
  guestCandidate: unknown;
  guestRepository: GuestRepository<TContext>;
  /** `BOOKING_HOLD_DURATION_MINUTES` from `getServerEnvironment()`; never hardcoded here. */
  holdDurationMinutes: number;
  holdRepository: HoldRepository<TContext>;
  interval: LodgingInterval;
  /** Injectable clock so `expiresAt` and expiry-lifecycle tests are deterministic. */
  now?: () => Date;
  /** One or more distinct rooms; a single-room checkout passes an array of one. */
  rooms: readonly CreatePaymentHoldRoom[];
  roomLockGateway: RoomLockGateway<TContext>;
}>;

function assertPositiveHoldDuration(holdDurationMinutes: number) {
  if (!Number.isSafeInteger(holdDurationMinutes) || holdDurationMinutes <= 0) {
    throw new RangeError("holdDurationMinutes must be a positive safe integer");
  }
}

function computeExpiresAt(now: () => Date, holdDurationMinutes: number) {
  const MILLISECONDS_PER_MINUTE = 60_000;
  return new Date(
    now().getTime() + holdDurationMinutes * MILLISECONDS_PER_MINUTE
  );
}

/**
 * Implements design.md decision 7's "Retención antes de Checkout Pro" for
 * the online-payment path (`Elección de modalidad de pago` /
 * `Pago online` scenario in the booking-engine spec), generalized to N
 * rooms under a single hold and a single total (see
 * `add-mercado-pago-checkout-pro` design.md decision 1): validates guest
 * input and capacity per room, computes authoritative pricing for every
 * room (`computeMultiRoomReservationPricing`), then — only if every room
 * is still available — creates the guest and one hold with one item per
 * room inside the same `RoomLockGateway.runExclusiveMany` transaction.
 *
 * Guest/capacity validation runs before the lock is ever acquired: an
 * invalid request fails fast and never touches `guestRepository`,
 * `holdRepository`, or the room lock, regardless of the rooms' real
 * availability.
 *
 * If any room is unavailable, `roomLockGateway.runExclusiveMany` throws
 * `RoomLockConflictError`; this function does not catch it; it is the
 * caller's responsibility (e.g. the checkout flow, not built in this
 * task) to translate that into an "unavailable" outcome.
 */
export async function createPaymentHold<TContext>(
  params: CreatePaymentHoldParams<TContext>
): Promise<ReservationHoldRecord> {
  const {
    chargesByRoom = new Map(),
    guestCandidate,
    guestRepository,
    holdDurationMinutes,
    holdRepository,
    interval,
    now = () => new Date(),
    rooms,
    roomLockGateway,
  } = params;

  assertPositiveHoldDuration(holdDurationMinutes);

  // Fails fast on invalid guest input or over-capacity guest counts,
  // outside the lock: a request that is invalid regardless of
  // availability should never contend for the room lock.
  const guest = parseGuestInput(guestCandidate);
  for (const room of rooms) {
    assertGuestCountWithinCapacity(room.guestCount ?? 1, room.capacity);
  }
  const pricing = computeMultiRoomReservationPricing(
    interval,
    rooms,
    chargesByRoom
  );

  return roomLockGateway.runExclusiveMany(
    rooms.map((room) => room.id),
    interval,
    async (context) => {
      const persistedGuest = await guestRepository.createGuest(context, guest);

      const input: CreateHoldInput = {
        checkIn: interval.checkIn,
        checkOut: interval.checkOut,
        expiresAt: computeExpiresAt(now, holdDurationMinutes),
        guestId: persistedGuest.id,
        items: pricing.items,
        totalClp: pricing.totalClp,
      };

      return holdRepository.createHold(context, input);
    }
  );
}
