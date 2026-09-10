import type { RoomOccupancyPrice } from "@/features/rooms/read-model";

export class InvalidOccupancyError extends RangeError {
  readonly code = "INVALID_OCCUPANCY" as const;
}

/**
 * Resolves a room's authoritative nightly price for a specific occupancy
 * (see `room-occupancy-pricing` spec). A room without a configured price
 * for the requested occupancy - including one with no occupancy prices at
 * all - falls back to its single `nightlyPriceClp`.
 */
export function resolveRoomNightlyPrice(
  room: Readonly<{ capacity: number; nightlyPriceClp: number }>,
  occupancyPrices: readonly RoomOccupancyPrice[],
  guestCount: number
): number {
  if (
    !Number.isSafeInteger(guestCount) ||
    guestCount < 1 ||
    guestCount > room.capacity
  ) {
    throw new InvalidOccupancyError(
      `guestCount must be a safe integer between 1 and the room's capacity (${room.capacity})`
    );
  }

  const configured = occupancyPrices.find(
    (entry) => entry.occupancy === guestCount
  );

  return configured ? configured.priceClp : room.nightlyPriceClp;
}

/**
 * Clamps a display-only occupancy into `1..capacity` before resolving a
 * price, so a stale cart entry (e.g. from before an admin shrank a room's
 * capacity) degrades to the nearest valid tier instead of throwing and
 * crashing the page during render. Server-authoritative pricing (quote,
 * checkout) MUST keep using `resolveRoomNightlyPrice` directly so invalid
 * occupancy is rejected, never silently clamped.
 */
export function resolveDisplayRoomNightlyPrice(
  room: Readonly<{ capacity: number; nightlyPriceClp: number }>,
  occupancyPrices: readonly RoomOccupancyPrice[],
  guestCount: number
): number {
  const safeCapacity = Math.max(1, room.capacity);
  const safeGuestCount = Math.min(
    Math.max(1, Math.trunc(guestCount) || 1),
    safeCapacity
  );
  return resolveRoomNightlyPrice(
    { ...room, capacity: safeCapacity },
    occupancyPrices,
    safeGuestCount
  );
}
