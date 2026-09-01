import "server-only";

import type { AvailabilityRepository } from "@/features/availability";
import { listOccupyingIntervals } from "./room-lock";
import type { ProductionDatabase } from "./client";

/**
 * Read-only, Drizzle/PostgreSQL-backed `AvailabilityRepository` for the
 * public availability search. Reuses the exact same occupancy query the
 * transactional room lock (`./room-lock.ts`) applies before committing a
 * reservation, so a search result and the authoritative lock check can
 * never disagree on what counts as occupying a room.
 *
 * This is a snapshot read outside any lock - by design, since the search
 * result is advisory. The authoritative recheck still happens inside the
 * lock when a booking is actually confirmed.
 */
export function createDrizzleAvailabilityRepository(
  db: ProductionDatabase
): AvailabilityRepository {
  return Object.freeze({
    listOccupyingIntervals: (roomId: string) =>
      listOccupyingIntervals(db, roomId, new Date()),
  });
}
