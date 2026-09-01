import { createLodgingInterval } from "./date-only";
import type { OccupyingInterval } from "./occupancy";

/**
 * Minimal, persistence-agnostic shape of the fields this feature needs
 * from a `reservations` row (see `src/persistence/schema.ts`). Deliberately
 * not imported from the Drizzle schema, mirroring the pattern in
 * `src/features/rooms/read-model.ts` (`RoomReadModel`): this feature must
 * stay usable without a database driver.
 *
 * Only `status === "confirmed"` reservations occupy availability.
 * `cancelled` reservations explicitly free it, and `completed`/`no_show`
 * are historical/past-dated, so they are irrelevant to a forward-looking
 * availability check (see design.md decision 8).
 */
export type ReservationRecord = Readonly<{
  checkIn: string;
  checkOut: string;
  id: string;
  roomId: string;
  status: "cancelled" | "completed" | "confirmed" | "no_show";
}>;

/**
 * Minimal shape of a `reservation_holds` row. A hold is "vigente"
 * (unexpired) when `expiresAt` is after the reference time.
 */
export type HoldRecord = Readonly<{
  checkIn: string;
  checkOut: string;
  expiresAt: Date | string;
  id: string;
  roomId: string;
}>;

/**
 * Minimal shape of a `room_blocks` row. A block is active while
 * `removedAt` is `null`.
 */
export type BlockRecord = Readonly<{
  checkIn: string;
  checkOut: string;
  id: string;
  removedAt: Date | string | null;
  roomId: string;
}>;

export type AvailabilityRecords = Readonly<{
  blocks: readonly BlockRecord[];
  holds: readonly HoldRecord[];
  reservations: readonly ReservationRecord[];
}>;

/**
 * Read-only contract for combining active reservations, unexpired holds,
 * and active room blocks into the intervals that occupy a room.
 *
 * `listOccupyingIntervals` returns a `Promise` even though the mock
 * implementation resolves synchronously: a database-backed adapter (task
 * 4.4+) will need to query PostgreSQL, so callers of this contract must
 * already treat it as asynchronous to avoid a breaking change once that
 * adapter is introduced.
 */
export type AvailabilityRepository = Readonly<{
  listOccupyingIntervals: (
    roomId: string
  ) => Promise<readonly OccupyingInterval[]>;
}>;

function isConfirmedReservation(reservation: ReservationRecord) {
  return reservation.status === "confirmed";
}

function isUnexpiredHold(hold: HoldRecord, now: Date) {
  return new Date(hold.expiresAt).getTime() > now.getTime();
}

function isActiveBlock(block: BlockRecord) {
  return block.removedAt == null;
}

type RoomScopedOccupyingInterval = Readonly<{
  occupying: OccupyingInterval;
  roomId: string;
}>;

/**
 * Builds a deterministic, in-memory `AvailabilityRepository` from explicit
 * records. This is the only implementation this task provides: it keeps
 * the availability feature persistence-agnostic and mock-first (see
 * design.md decision 13). A database-backed implementation of the same
 * contract is deferred to task 4.4, which needs a real transaction to
 * serialize the check under a row lock.
 *
 * `now` is injectable (defaulting to real time) so hold-expiry filtering
 * is deterministic in tests.
 */
export function createMockAvailabilityRepository(
  records: AvailabilityRecords,
  now: () => Date = () => new Date()
): AvailabilityRepository {
  const roomScoped: readonly RoomScopedOccupyingInterval[] = Object.freeze([
    ...records.reservations.filter(isConfirmedReservation).map((reservation) =>
      Object.freeze({
        occupying: Object.freeze({
          interval: createLodgingInterval(
            reservation.checkIn,
            reservation.checkOut
          ),
          source: "reservation" as const,
          sourceId: reservation.id,
        }),
        roomId: reservation.roomId,
      })
    ),
    ...records.holds
      .filter((hold) => isUnexpiredHold(hold, now()))
      .map((hold) =>
        Object.freeze({
          occupying: Object.freeze({
            interval: createLodgingInterval(hold.checkIn, hold.checkOut),
            source: "hold" as const,
            sourceId: hold.id,
          }),
          roomId: hold.roomId,
        })
      ),
    ...records.blocks.filter(isActiveBlock).map((block) =>
      Object.freeze({
        occupying: Object.freeze({
          interval: createLodgingInterval(block.checkIn, block.checkOut),
          source: "block" as const,
          sourceId: block.id,
        }),
        roomId: block.roomId,
      })
    ),
  ]);

  return Object.freeze({
    listOccupyingIntervals: (roomId: string) =>
      Promise.resolve(
        Object.freeze(
          roomScoped
            .filter((entry) => entry.roomId === roomId)
            .map((entry) => entry.occupying)
        )
      ),
  });
}
