import type { LodgingInterval } from "@/features/availability";
import type { RoomReadModel } from "@/features/rooms";

import { assertGuestCountWithinCapacity } from "./capacity";
import { type GuestBookingInput, parseGuestInput } from "./guest";
import {
  computeReservationPricing,
  type ReservationCharge,
  type ReservationPricingResult,
} from "./pricing";

export type ReservationQuote = Readonly<{
  guest: GuestBookingInput;
  pricing: ReservationPricingResult;
}>;

export type ReservationQuoteRoom = Pick<
  RoomReadModel,
  "capacity" | "nightlyPriceClp"
>;

/**
 * Single composition point shared by every reservation-creation path
 * (checkout, pay-at-property, admin manual booking, and later the AI
 * assistant's deterministic revalidation). It performs, in order:
 *
 * 1. Guest input validation (throws `InvalidGuestInputError`).
 * 2. Capacity validation against the room's real capacity (throws
 *    `GuestCapacityExceededError`).
 * 3. Authoritative nightly pricing and frozen totals.
 *
 * Guest validation runs first because capacity validation depends on a
 * validated `guestCount`. This function is pure domain logic: it never
 * touches the database, a payment provider, or any other I/O.
 */
export function buildReservationQuote(
  guestCandidate: unknown,
  room: ReservationQuoteRoom,
  interval: LodgingInterval,
  charges: readonly ReservationCharge[] = []
): ReservationQuote {
  const guest = parseGuestInput(guestCandidate);

  assertGuestCountWithinCapacity(guest.guestCount, room.capacity);

  const pricing = computeReservationPricing(
    interval,
    room.nightlyPriceClp,
    charges
  );

  return Object.freeze({ guest, pricing });
}
