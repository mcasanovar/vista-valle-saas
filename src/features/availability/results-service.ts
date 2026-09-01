import "server-only";

import {
  getRoomReadSource,
  type RoomReadModel,
  type RoomReadSource,
} from "@/features/rooms";
import type { AvailabilityRepository } from "./occupancy-source";
import {
  SelectedRoomUnavailableError,
  searchAvailability,
  type AvailabilitySearchResult,
} from "./search";
import { getAvailabilitySearchRepository } from "./search-source";
import {
  type AvailabilityResultsQuery,
  type AvailabilityResultsQueryValidation,
} from "./results-query";

export type AvailabilityResultsDependencies = Readonly<{
  availabilityRepository: AvailabilityRepository;
  roomSource: RoomReadSource;
}>;

export type AvailabilityResultsComposition =
  | Readonly<{
      kind: "invalid-query";
      validation: Extract<AvailabilityResultsQueryValidation, { ok: false }>;
    }>
  | Readonly<{
      kind: "results";
      query: AvailabilityResultsQuery;
      rooms: readonly RoomReadModel[];
      search: AvailabilitySearchResult;
    }>
  | Readonly<{
      kind: "selected-room-unavailable";
      query: AvailabilityResultsQuery;
      message: string;
    }>;

async function defaultDependencies(): Promise<AvailabilityResultsDependencies> {
  return Object.freeze({
    availabilityRepository: getAvailabilitySearchRepository(),
    roomSource: await getRoomReadSource(),
  });
}

/**
 * Server-only read composition for availability results. It deliberately
 * calls the use case directly, rather than an internal Route Handler, and
 * exposes enough configured room data for presentation without widening the
 * authorization granted by `searchAvailability`.
 */
export async function composeAvailabilityResults(
  validation: AvailabilityResultsQueryValidation,
  dependencies?: AvailabilityResultsDependencies
): Promise<AvailabilityResultsComposition> {
  if (!validation.ok) {
    return Object.freeze({ kind: "invalid-query", validation });
  }

  const resolvedDependencies = dependencies ?? (await defaultDependencies());

  try {
    const search = await searchAvailability(
      validation.value,
      resolvedDependencies
    );
    const authorizedIds = new Set(search.rooms.map((room) => room.id));
    const rooms = Object.freeze(
      resolvedDependencies.roomSource
        .listActive()
        .filter((room) => authorizedIds.has(room.id))
    );

    return Object.freeze({
      kind: "results",
      query: validation.value,
      rooms,
      search,
    });
  } catch (cause) {
    if (cause instanceof SelectedRoomUnavailableError) {
      return Object.freeze({
        kind: "selected-room-unavailable",
        query: validation.value,
        message: cause.message,
      });
    }
    throw cause;
  }
}
