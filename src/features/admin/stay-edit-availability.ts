import "server-only";

import {
  checkRoomAvailability,
  createLodgingInterval,
  getAvailabilitySearchRepository,
  type AvailabilityRepository,
  type OccupyingInterval,
} from "@/features/availability";
import {
  getRoomReadSource,
  type RoomOccupancyPrice,
  type RoomReadSource,
} from "@/features/rooms";
import { requireAdministrator } from "@/infrastructure/auth/authorization";

/**
 * Rooms selectable for a stay edit over a given interval.
 *
 * Deliberately **not** a parameterization of
 * `./manual-reservation-availability.ts`: that boundary applies
 * `validateManualReservationDateRange`, the public rule that a check-in
 * may not precede today. A stay edit must work on a reservation already
 * under way - the case this feature exists for - so no minimum-date rule
 * is applied here, matching what `parseRequestedStayInterval` documents
 * for the domain.
 *
 * Keeping it a separate function rather than a flag on the manual
 * boundary is the point: a flag that relaxes a public rule is easy to
 * switch on by mistake from the public flow, while this module is not
 * reachable from there at all (design.md "Un BFF de disponibilidad propio
 * para la edición, no el de creación manual").
 */
export type StayEditAvailability = Readonly<{
  checkIn: string;
  checkOut: string;
  rooms: readonly Readonly<{
    capacity: number;
    id: string;
    name: string;
    nightlyPriceClp: number;
    occupancyPrices: readonly RoomOccupancyPrice[];
  }>[];
}>;

export class StayEditAvailabilityInputError extends Error {
  readonly code = "INVALID_STAY_EDIT_AVAILABILITY" as const;
}

export class StayEditAvailabilityAuthorizationError extends Error {
  readonly code = "UNAUTHORIZED_STAY_EDIT_AVAILABILITY" as const;
}

/**
 * Drops the occupancy produced by the reservation being edited, so the
 * rooms it already holds come back as selectable instead of looking taken
 * by someone else. Mirrors `excludeReservationId` in the room-lock
 * gateway, which performs the same exclusion when the write is revalidated
 * under the lock.
 */
function withoutOwnOccupancy(
  occupancy: readonly OccupyingInterval[],
  excludeReservationId: string | undefined
): readonly OccupyingInterval[] {
  if (!excludeReservationId) return occupancy;
  return occupancy.filter(
    (entry) =>
      !(
        entry.source === "reservation" &&
        entry.sourceId === excludeReservationId
      )
  );
}

export async function resolveStayEditAvailability(
  candidate: Readonly<{
    checkIn?: unknown;
    checkOut?: unknown;
    excludeReservationId?: string;
  }>,
  dependencies: Readonly<{
    availabilityRepository: AvailabilityRepository;
    roomSource: RoomReadSource;
  }>
): Promise<StayEditAvailability> {
  let interval;
  try {
    interval = createLodgingInterval(
      String(candidate.checkIn ?? ""),
      String(candidate.checkOut ?? "")
    );
  } catch {
    throw new StayEditAvailabilityInputError(
      "Selecciona fechas de entrada y salida válidas."
    );
  }

  // No minimum-date validation on purpose: see the module comment.

  const rooms = await Promise.all(
    dependencies.roomSource.listActive().map(async (room) => {
      const occupancy = withoutOwnOccupancy(
        await dependencies.availabilityRepository.listOccupyingIntervals(
          room.id
        ),
        candidate.excludeReservationId
      );
      return checkRoomAvailability(occupancy, interval).available
        ? Object.freeze({
            capacity: room.capacity,
            id: room.id,
            name: room.name,
            nightlyPriceClp: room.nightlyPriceClp,
            occupancyPrices: room.occupancyPrices,
          })
        : null;
    })
  );

  return Object.freeze({
    checkIn: interval.checkIn,
    checkOut: interval.checkOut,
    rooms: Object.freeze(
      rooms.filter((room): room is NonNullable<typeof room> => room !== null)
    ),
  });
}

/** Authenticated BFF boundary for the stay-edit room selection. */
export async function getStayEditAvailability(
  candidate: Readonly<{
    checkIn?: unknown;
    checkOut?: unknown;
    excludeReservationId?: string;
  }>
) {
  try {
    await requireAdministrator();
  } catch {
    throw new StayEditAvailabilityAuthorizationError(
      "La disponibilidad de edición de estadía requiere un administrador."
    );
  }
  return resolveStayEditAvailability(candidate, {
    availabilityRepository: getAvailabilitySearchRepository(),
    roomSource: await getRoomReadSource(),
  });
}
