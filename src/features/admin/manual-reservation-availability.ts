import "server-only";

import {
  checkRoomAvailability,
  createLodgingInterval,
  getAvailabilitySearchRepository,
  type AvailabilityRepository,
} from "@/features/availability";
import { getRoomReadSource, type RoomReadSource } from "@/features/rooms";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { validateManualReservationDateRange } from "./manual-reservation-contract";

export type ManualReservationAvailability = Readonly<{
  checkIn: string;
  checkOut: string;
  rooms: readonly Readonly<{
    capacity: number;
    id: string;
    name: string;
    nightlyPriceClp: number;
  }>[];
}>;

export class ManualReservationAvailabilityInputError extends Error {
  readonly code = "INVALID_MANUAL_RESERVATION_AVAILABILITY" as const;
}

export class ManualReservationAvailabilityAuthorizationError extends Error {
  readonly code = "UNAUTHORIZED_MANUAL_RESERVATION_AVAILABILITY" as const;
}

export async function resolveManualReservationAvailability(
  candidate: Readonly<{ checkIn?: unknown; checkOut?: unknown }>,
  dependencies: Readonly<{
    availabilityRepository: AvailabilityRepository;
    roomSource: RoomReadSource;
  }>
): Promise<ManualReservationAvailability> {
  let interval;
  try {
    interval = createLodgingInterval(
      String(candidate.checkIn ?? ""),
      String(candidate.checkOut ?? "")
    );
  } catch {
    throw new ManualReservationAvailabilityInputError(
      "Selecciona fechas de entrada y salida válidas."
    );
  }

  const dateErrors = validateManualReservationDateRange(
    interval.checkIn,
    interval.checkOut
  );
  if (dateErrors.length) {
    throw new ManualReservationAvailabilityInputError(dateErrors[0]!.message);
  }

  const rooms = await Promise.all(
    dependencies.roomSource.listActive().map(async (room) => {
      const occupancy =
        await dependencies.availabilityRepository.listOccupyingIntervals(
          room.id
        );
      return checkRoomAvailability(occupancy, interval).available
        ? Object.freeze({
            capacity: room.capacity,
            id: room.id,
            name: room.name,
            nightlyPriceClp: room.nightlyPriceClp,
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

/** Authenticated BFF boundary for date-dependent manual room selection. */
export async function getManualReservationAvailability(
  candidate: Readonly<{ checkIn?: unknown; checkOut?: unknown }>
) {
  try {
    await requireAdministrator();
  } catch {
    throw new ManualReservationAvailabilityAuthorizationError(
      "La disponibilidad de reservas manuales requiere un administrador."
    );
  }
  return resolveManualReservationAvailability(candidate, {
    availabilityRepository: getAvailabilitySearchRepository(),
    roomSource: await getRoomReadSource(),
  });
}
