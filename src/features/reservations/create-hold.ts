import type { LodgingInterval, RoomLockGateway } from "@/features/availability";
import type { RoomReadModel } from "@/features/rooms";

import type { GuestRepository } from "./guest-repository";
import type {
  CreateHoldInput,
  HoldRepository,
  ReservationHoldRecord,
} from "./hold-repository";
import type { ReservationCharge } from "./pricing";
import { buildReservationQuote } from "./quote";

export type CreatePaymentHoldRoom = Pick<
  RoomReadModel,
  "capacity" | "id" | "nightlyPriceClp"
> &
  Readonly<{ occupancyPrices?: RoomReadModel["occupancyPrices"] }>;

/**
 * Everything `createPaymentHold` needs. `TContext` is inferred from
 * `roomLockGateway`, and `guestRepository`/`holdRepository` MUST share the
 * exact same `TContext` so the same context/transaction handed to them by
 * `RoomLockGateway.runExclusive` threads through unchanged (see
 * `./guest-repository.ts` and `./hold-repository.ts`).
 */
export type CreatePaymentHoldParams<TContext> = Readonly<{
  /** Applicable extra charges, defaulting to none (Vista Valle has no configured charges for the MVP). */
  charges?: readonly ReservationCharge[];
  /** Raw, untrusted guest booking input; validated by `buildReservationQuote`. */
  guestCandidate: unknown;
  guestRepository: GuestRepository<TContext>;
  /** `BOOKING_HOLD_DURATION_MINUTES` from `getServerEnvironment()`; never hardcoded here. */
  holdDurationMinutes: number;
  holdRepository: HoldRepository<TContext>;
  interval: LodgingInterval;
  /** Injectable clock so `expiresAt` and expiry-lifecycle tests are deterministic. */
  now?: () => Date;
  room: CreatePaymentHoldRoom;
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
 * `Pago online` scenario in the booking-engine spec): validates guest
 * input and capacity, computes authoritative pricing (task 4.2's
 * `buildReservationQuote`), then — only if the room is still available —
 * creates the guest and a temporary hold inside the same
 * `RoomLockGateway.runExclusive` transaction (task 4.4), with `expiresAt`
 * set to `now() + holdDurationMinutes`.
 *
 * Guest/capacity validation runs before the lock is ever acquired: an
 * invalid request fails fast and never touches `guestRepository`,
 * `holdRepository`, or the room lock, regardless of the room's real
 * availability.
 *
 * If the room is unavailable, `roomLockGateway.runExclusive` throws
 * `RoomLockConflictError`; this function does not catch it; it is the
 * caller's responsibility (e.g. the checkout flow, not built in this
 * task) to translate that into an "unavailable" outcome.
 */
export async function createPaymentHold<TContext>(
  params: CreatePaymentHoldParams<TContext>
): Promise<ReservationHoldRecord> {
  const {
    charges = [],
    guestCandidate,
    guestRepository,
    holdDurationMinutes,
    holdRepository,
    interval,
    now = () => new Date(),
    room,
    roomLockGateway,
  } = params;

  assertPositiveHoldDuration(holdDurationMinutes);

  // Fails fast on invalid guest input or over-capacity guest counts,
  // outside the lock: a request that is invalid regardless of
  // availability should never contend for the room lock.
  const quote = buildReservationQuote(guestCandidate, room, interval, charges);

  return roomLockGateway.runExclusive(room.id, interval, async (context) => {
    const guest = await guestRepository.createGuest(context, quote.guest);

    const input: CreateHoldInput = {
      checkIn: interval.checkIn,
      checkOut: interval.checkOut,
      expiresAt: computeExpiresAt(now, holdDurationMinutes),
      guestCount: quote.guest.guestCount,
      guestId: guest.id,
      pricing: quote.pricing,
      roomId: room.id,
    };

    return holdRepository.createHold(context, input);
  });
}
