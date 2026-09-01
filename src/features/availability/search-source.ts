import "server-only";

import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleAvailabilityRepository } from "@/infrastructure/database/availability-source";
import { createMockAvailabilityRepository } from "./occupancy-source";

export class AvailabilitySearchSourceUnavailableError extends Error {
  readonly code = "AVAILABILITY_SEARCH_SOURCE_UNAVAILABLE" as const;
}

/** Kept for the fail-closed contract already covered by existing tests. */
export function createAvailabilitySearchRepository(
  context: "mock" | "production"
) {
  if (context !== "mock") {
    throw new AvailabilitySearchSourceUnavailableError(
      "Availability search source is not configured"
    );
  }
  return createMockAvailabilityRepository({
    blocks: [],
    holds: [],
    reservations: [],
  });
}

export function getAvailabilitySearchRepository() {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return createAvailabilitySearchRepository("mock");
  }
  return createDrizzleAvailabilityRepository(
    createProductionDatabase(boundary)
  );
}
