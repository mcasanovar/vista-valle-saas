import {
  type LodgingInterval,
  nights as calculateNights,
} from "@/features/availability";

/**
 * A generic, extensible applicable charge (e.g. a cleaning fee). Vista
 * Valle has no configured extra charges for the MVP, so callers pass an
 * empty list and `chargesClp` resolves to `0`.
 */
export type ReservationCharge = Readonly<{
  amountClp: number;
  label: string;
}>;

/**
 * The frozen, server-authoritative pricing outcome for a reservation or
 * hold. `totalClp` is always derived from `nights * nightlyPriceClp +
 * chargesClp`; there is no way to pass in an external total.
 */
export type ReservationPricingResult = Readonly<{
  chargesClp: number;
  nightlyPriceClp: number;
  nights: number;
  totalClp: number;
}>;

export type ReservationItemPricingResult = ReservationPricingResult &
  Readonly<{ guestCount: number; roomId: string }>;

export type MultiRoomReservationPricingResult = Readonly<{
  items: readonly ReservationItemPricingResult[];
  nights: number;
  totalClp: number;
}>;

export class InvalidPricingInputError extends RangeError {
  readonly code = "INVALID_PRICING_INPUT" as const;

  constructor(message: string) {
    super(message);
    this.name = "InvalidPricingInputError";
  }
}

/** Computes frozen, server-authoritative totals for a distinct room selection. */
export function computeMultiRoomReservationPricing(
  interval: LodgingInterval,
  rooms: readonly Readonly<{
    guestCount?: number;
    id: string;
    nightlyPriceClp: number;
  }>[],
  chargesByRoom: ReadonlyMap<string, readonly ReservationCharge[]> = new Map()
): MultiRoomReservationPricingResult {
  const ids = new Set<string>();
  const items = rooms
    .slice()
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((room) => {
      if (!room.id || ids.has(room.id))
        throw new InvalidPricingInputError("Rooms must be distinct");
      const guestCount = room.guestCount ?? 1;
      if (!Number.isSafeInteger(guestCount) || guestCount <= 0)
        throw new InvalidPricingInputError(
          "Guest count must be a positive safe integer"
        );
      ids.add(room.id);
      return Object.freeze({
        guestCount,
        roomId: room.id,
        ...computeReservationPricing(
          interval,
          room.nightlyPriceClp,
          chargesByRoom.get(room.id) ?? []
        ),
      });
    });
  if (items.length === 0)
    throw new InvalidPricingInputError("At least one room is required");
  const totalClp = items.reduce((total, item) => total + item.totalClp, 0);
  assertNonNegativeSafeIntegerAmount(totalClp, "Aggregate total");
  return Object.freeze({
    items: Object.freeze(items),
    nights: items[0]!.nights,
    totalClp,
  });
}

function assertNonNegativeSafeIntegerAmount(amount: number, label: string) {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new InvalidPricingInputError(
      `${label} must be a non-negative safe integer CLP amount`
    );
  }
}

/**
 * Computes the authoritative pricing for a lodging interval. This is the
 * single source of truth for reservation and hold totals: it recomputes
 * `nights`, `chargesClp`, and `totalClp` from trusted inputs every time and
 * never accepts (or trusts) a caller-supplied total.
 *
 * Date validity is delegated to `nights()` from `@/features/availability`;
 * this function only re-validates the pricing-specific numeric inputs.
 */
export function computeReservationPricing(
  interval: LodgingInterval,
  nightlyPriceClp: number,
  charges: readonly ReservationCharge[] = []
): ReservationPricingResult {
  const nightsCount = calculateNights(interval.checkIn, interval.checkOut);

  if (!Number.isSafeInteger(nightsCount) || nightsCount <= 0) {
    throw new InvalidPricingInputError(
      "Nights must be a positive safe integer"
    );
  }

  assertNonNegativeSafeIntegerAmount(nightlyPriceClp, "Nightly price");

  const chargesClp = charges.reduce((sum, charge) => {
    assertNonNegativeSafeIntegerAmount(
      charge.amountClp,
      `Charge "${charge.label}"`
    );
    return sum + charge.amountClp;
  }, 0);

  assertNonNegativeSafeIntegerAmount(chargesClp, "Total charges");

  const totalClp = nightsCount * nightlyPriceClp + chargesClp;

  assertNonNegativeSafeIntegerAmount(totalClp, "Total");

  return Object.freeze({
    chargesClp,
    nightlyPriceClp,
    nights: nightsCount,
    totalClp,
  });
}
