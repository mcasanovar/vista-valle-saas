import { createLodgingInterval, type LodgingInterval } from "./date-only";
import {
  checkRoomAvailability,
  type OccupancySource,
  type OccupyingInterval,
} from "./occupancy";
import {
  createMockAvailabilityRepository,
  type AvailabilityRecords,
} from "./occupancy-source";

/**
 * Thrown by a `RoomLockGateway.runExclusive` implementation when the final,
 * re-checked overlap validation (run while the room is locked) finds that
 * the requested interval still overlaps at least one occupying interval.
 * Callers must treat this as the authoritative "not available" outcome —
 * see design.md decision 6 and the `booking-engine` spec requirement
 * "Prevención atómica de superposiciones".
 */
export class RoomLockConflictError extends Error {
  readonly code = "ROOM_LOCK_CONFLICT" as const;
  readonly conflicts: readonly OccupyingInterval[];
  readonly roomId?: string;

  constructor(conflicts: readonly OccupyingInterval[], roomId?: string) {
    super(
      "The requested interval conflicts with an existing reservation, hold, or block for this room"
    );
    this.name = "RoomLockConflictError";
    this.conflicts = Object.freeze([...conflicts]);
    this.roomId = roomId;
  }
}

/**
 * Persistence-agnostic contract for the "lock the room, recheck overlap,
 * then act" transaction described in design.md decision 6. `TContext` is
 * whatever the underlying adapter hands to `operation` once the room is
 * proven available: for the mock adapter (`createMockRoomLockGateway`,
 * below) it is a handle that lets the operation record what it created so
 * later calls for the same room see it as occupied; for the Drizzle-backed
 * adapter (`src/infrastructure/database/room-lock.ts`) it is the open
 * `PgTransaction` the `SELECT ... FOR UPDATE` ran in, so the caller's
 * insert(s) commit or roll back atomically with the lock.
 *
 * Every future caller that creates a hold, reservation, or block (tasks
 * 4.5, 4.6, and the assistant's block execution) must go through the same
 * `runExclusive` contract instead of checking availability and inserting
 * separately, so the atomic-overlap guarantee is enforced in one place.
 */
export type RoomLockGateway<TContext> = Readonly<{
  listOccupyingIntervals?: (roomId: string) => Promise<readonly OccupyingInterval[]>;
  runLockedMany: <TResult>(
    roomIds: readonly string[],
    operation: (context: TContext) => Promise<TResult>
  ) => Promise<TResult>;
  /** Locks distinct room ids in lexical order, checks every room, then runs one all-or-nothing operation. */
  runExclusiveMany: <TResult>(
    roomIds: readonly string[],
    requestedInterval: LodgingInterval,
    operation: (context: TContext) => Promise<TResult>
  ) => Promise<TResult>;
  /**
   * Runs an operation while serializing changes for a room without treating
   * that room's existing reservation as a creation conflict. This is for
   * state changes/removals only; new occupancy must always use runExclusive.
   */
  runLocked: <TResult>(
    roomId: string,
    operation: (context: TContext) => Promise<TResult>
  ) => Promise<TResult>;
  /**
   * Serializes concurrent calls for the same `roomId` (calls for different
   * rooms run independently), obtains a fresh view of what currently
   * occupies the room, and re-validates `requestedInterval` against it.
   *
   * - If the interval is unavailable, throws `RoomLockConflictError` with
   *   the conflicting intervals and never calls `operation`.
   * - If the interval is available, calls `operation(context)` while the
   *   room remains locked for other callers, and resolves with its result.
   */
  runExclusive: <TResult>(
    roomId: string,
    requestedInterval: LodgingInterval,
    operation: (context: TContext) => Promise<TResult>
  ) => Promise<TResult>;
}>;

/**
 * The context handed to `operation` by `createMockRoomLockGateway`. The
 * mock gateway keeps a mutable in-memory list of occupying intervals per
 * room; because nothing is actually inserted into a database, the
 * operation must explicitly register what it "created" through
 * `recordOccupancy` so a subsequent `runExclusive` call for the same room
 * sees it as occupied.
 *
 * `expiresAt` is optional and only meaningful for `source: "hold"`
 * entries: when present, the gateway re-checks it against `now()` on
 * every later `runExclusive` call (not just once), so a recorded hold
 * that has since expired stops blocking the room without any
 * administrative intervention, matching the `booking-engine` spec's
 * "Vencimiento de retenciones" requirement and
 * `createMockAvailabilityRepository`'s `isUnexpiredHold` filtering.
 * Reservations and blocks recorded here have no such mechanism yet
 * (nothing currently records their removal/cancellation through this
 * context), so omitting `expiresAt` for them keeps today's behavior.
 */
export type MockRoomLockOperationContext = Readonly<{
  removeOccupancy: (
    source: OccupancySource,
    sourceId: string,
    roomId?: string
  ) => void;
  recordOccupancy: (
    entry: OccupyingInterval & Readonly<{ expiresAt?: Date; roomId?: string }>
  ) => void;
}>;

/**
 * One room's cached occupancy entry. `expiresAt`, when present, means
 * `occupying` must be excluded from availability checks once `now()` is
 * at or after it — this is what lets a single, long-lived gateway
 * instance correctly "forget" an expired hold instead of only filtering
 * expiry once at seed time.
 */
type CachedOccupancyEntry = Readonly<{
  expiresAt?: Date;
  occupying: OccupyingInterval;
}>;

function isCurrentlyOccupying(entry: CachedOccupancyEntry, now: Date) {
  return (
    entry.expiresAt === undefined || entry.expiresAt.getTime() > now.getTime()
  );
}

function resolvedVoid() {
  return Promise.resolve();
}

/**
 * A real in-process async mutex keyed by `roomId`: it chains each new call
 * for a room onto a promise that only settles once every previously
 * queued call for that same room has itself settled (successfully or not).
 * Calls for different rooms are not chained together and therefore never
 * block each other.
 *
 * This is deliberately a genuine chain of `Promise`s (not a synchronous
 * flag or a timer) so that two calls started concurrently via
 * `Promise.all`/`Promise.allSettled` are still forced to run their
 * check-then-act sequence one after the other.
 */
function createRoomMutex() {
  const queueByRoomId = new Map<string, Promise<void>>();

  return function withRoomLock<TResult>(
    roomId: string,
    run: () => Promise<TResult>
  ): Promise<TResult> {
    const previous = queueByRoomId.get(roomId) ?? resolvedVoid();
    const settled = previous.then(run, run);

    queueByRoomId.set(roomId, settled.then(resolvedVoid, resolvedVoid));

    return settled;
  };
}

/**
 * Builds a deterministic, in-memory `RoomLockGateway` for tests and mock
 * infrastructure (see design.md decision 13). `seed` primes each room's
 * occupying intervals from the same shape `createMockAvailabilityRepository`
 * accepts; a room with no seed records starts fully available.
 *
 * `now` is injectable so hold-expiry filtering stays deterministic in
 * tests, matching `createMockAvailabilityRepository`. Unlike a naive
 * cache, `now()` is re-read on every `runExclusive` call (not just once,
 * at seed time): confirmed reservations and active blocks are seeded
 * once from `seedRepository` (they do not expire on their own, and
 * nothing yet records their cancellation/removal through
 * `recordOccupancy`), but holds — both seeded ones and ones recorded
 * later via `recordOccupancy`'s optional `expiresAt` — are re-filtered
 * against the current `now()` on every access. This is what lets a
 * single, long-lived gateway instance correctly stop treating a hold as
 * occupying once it expires, matching the "Vencimiento de retenciones"
 * spec requirement and the production Drizzle-backed adapter
 * (`src/infrastructure/database/room-lock.ts`), which re-queries
 * `reservation_holds` live on every call instead of caching.
 */
export function createMockRoomLockGateway(
  seed: AvailabilityRecords = { blocks: [], holds: [], reservations: [] },
  now: () => Date = () => new Date()
): RoomLockGateway<MockRoomLockOperationContext> {
  const seedRepository = createMockAvailabilityRepository(seed, now);
  const occupyingByRoomId = new Map<string, CachedOccupancyEntry[]>();
  const withRoomLock = createRoomMutex();

  async function loadRoomOccupancy(roomId: string) {
    const existing = occupyingByRoomId.get(roomId);
    if (existing) {
      return existing;
    }

    // Confirmed reservations and active blocks never expire on their
    // own, so `seedRepository`'s one-time status/removal filtering is
    // reused as-is here. Its holds are dropped and rebuilt below
    // directly from the raw seed records instead, because
    // `seedRepository` already discards `expiresAt` after applying a
    // one-time `isUnexpiredHold` filter, which is exactly the "only
    // filtered once" behavior this fix removes for holds.
    const nonExpiringSeed = (
      await seedRepository.listOccupyingIntervals(roomId)
    ).filter((occupying) => occupying.source !== "hold");

    const seededHolds: CachedOccupancyEntry[] = seed.holds
      .filter((hold) => hold.roomId === roomId)
      .map((hold) => ({
        expiresAt: new Date(hold.expiresAt),
        occupying: Object.freeze({
          interval: createLodgingInterval(hold.checkIn, hold.checkOut),
          source: "hold" as const,
          sourceId: hold.id,
        }),
      }));

    const seeded: CachedOccupancyEntry[] = [
      ...nonExpiringSeed.map((occupying) => Object.freeze({ occupying })),
      ...seededHolds,
    ];

    occupyingByRoomId.set(roomId, seeded);
    return seeded;
  }

  const createContext = (
    cached: CachedOccupancyEntry[],
    defaultRoomId: string,
    caches = new Map<string, CachedOccupancyEntry[]>()
  ): MockRoomLockOperationContext => ({
    removeOccupancy: (source, sourceId, roomId = defaultRoomId) => {
      const target = caches.get(roomId) ?? cached;
      const index = target.findIndex(
        (entry) =>
          entry.occupying.source === source &&
          entry.occupying.sourceId === sourceId
      );

      if (index >= 0) target.splice(index, 1);
    },
    recordOccupancy: ({ expiresAt, roomId = defaultRoomId, ...occupying }) => {
      (caches.get(roomId) ?? cached).push(
        Object.freeze({ expiresAt, occupying })
      );
    },
  });

  return Object.freeze({
    listOccupyingIntervals: async (roomId) =>
      Object.freeze(
        (await loadRoomOccupancy(roomId))
          .filter((entry) => isCurrentlyOccupying(entry, now()))
          .map((entry) => entry.occupying)
      ),
    runLockedMany: async (roomIds, operation) => {
      const ordered = [...new Set(roomIds)].sort();
      if (ordered.length !== roomIds.length || ordered.length === 0)
        throw new Error("Reservation requires distinct rooms");
      const acquire = async (index: number): Promise<unknown> =>
        withRoomLock(ordered[index]!, async () => {
          if (index + 1 < ordered.length) return acquire(index + 1);
          const caches = new Map<string, CachedOccupancyEntry[]>();
          for (const id of ordered) caches.set(id, await loadRoomOccupancy(id));
          return operation(
            createContext(caches.get(ordered[0]!)!, ordered[0]!, caches)
          );
        });
      return acquire(0) as never;
    },
    runExclusiveMany: async (roomIds, requestedInterval, operation) => {
      const ordered = [...new Set(roomIds)].sort();
      if (ordered.length !== roomIds.length || ordered.length === 0)
        throw new Error("Reservation requires distinct rooms");
      const acquire = async (index: number): Promise<unknown> => {
        const roomId = ordered[index]!;
        return withRoomLock(roomId, async () => {
          if (index + 1 < ordered.length) return acquire(index + 1);
          const caches = new Map<string, CachedOccupancyEntry[]>();
          for (const id of ordered) {
            const cached = await loadRoomOccupancy(id);
            caches.set(id, cached);
            const result = checkRoomAvailability(
              cached
                .filter((entry) => isCurrentlyOccupying(entry, now()))
                .map((entry) => entry.occupying),
              requestedInterval
            );
            if (!result.available)
              throw new RoomLockConflictError(result.conflicts, id);
          }
          return operation(
            createContext(caches.get(ordered[0]!)!, ordered[0]!, caches)
          );
        });
      };
      return acquire(0) as never;
    },
    runLocked: <TResult>(
      roomId: string,
      operation: (context: MockRoomLockOperationContext) => Promise<TResult>
    ) =>
      withRoomLock(roomId, async () =>
        operation(createContext(await loadRoomOccupancy(roomId), roomId))
      ),
    runExclusive: <TResult>(
      roomId: string,
      requestedInterval: LodgingInterval,
      operation: (context: MockRoomLockOperationContext) => Promise<TResult>
    ) =>
      withRoomLock(roomId, async () => {
        const cached = await loadRoomOccupancy(roomId);
        const nowValue = now();
        const occupying = cached
          .filter((entry) => isCurrentlyOccupying(entry, nowValue))
          .map((entry) => entry.occupying);
        const result = checkRoomAvailability(occupying, requestedInterval);

        if (!result.available) {
          throw new RoomLockConflictError(result.conflicts, roomId);
        }

        return operation(createContext(cached, roomId));
      }),
  });
}
