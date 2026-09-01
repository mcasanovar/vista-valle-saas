import { intervalsOverlap, type LodgingInterval } from "./date-only";

/**
 * The kind of domain record that can occupy a room for an interval. A room
 * is unavailable for a requested interval when at least one confirmed
 * reservation, unexpired hold, or active administrative block overlaps it
 * (see `booking-engine` spec, "Consulta de disponibilidad por habitación").
 */
export type OccupancySource = "reservation" | "hold" | "block";

/**
 * A normalized record representing one thing that occupies a room for a
 * lodging interval. Callers build these from reservations, holds, and
 * blocks (see `./occupancy-source`) so `checkRoomAvailability` never needs
 * to know about persistence-specific shapes.
 */
export type OccupyingInterval = Readonly<{
  interval: LodgingInterval;
  source: OccupancySource;
  sourceId: string;
}>;

export type RoomAvailabilityResult = Readonly<{
  available: boolean;
  conflicts: readonly OccupyingInterval[];
}>;

/**
 * Pure availability check for a single room: reports every occupying
 * interval (confirmed reservation, unexpired hold, or active block) that
 * overlaps the `requested` interval. Overlap uses `intervalsOverlap`
 * (half-open `[checkIn, checkOut)` intervals), so a same-day turnover —
 * one interval ending exactly when another begins — is never a conflict.
 *
 * This function does not filter by status, expiry, or removal; callers
 * must pass only currently-occupying intervals (see
 * `createMockAvailabilityRepository` in `./occupancy-source`, which
 * applies those filters before building `OccupyingInterval` records).
 */
export function checkRoomAvailability(
  occupying: readonly OccupyingInterval[],
  requested: LodgingInterval
): RoomAvailabilityResult {
  const conflicts = Object.freeze(
    occupying.filter((occupant) =>
      intervalsOverlap(occupant.interval, requested)
    )
  );

  return Object.freeze({
    available: conflicts.length === 0,
    conflicts,
  });
}
