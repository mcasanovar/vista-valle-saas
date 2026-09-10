import {
  compareLodgingDates,
  createLodgingInterval,
  publicAvailabilityDateMinimums,
  type AvailabilityRepository,
  checkRoomAvailability,
} from "@/features/availability";
import type { RoomReadSource } from "@/features/rooms";

export type AvailabilitySearchResult = Readonly<{
  checkIn: string;
  checkOut: string;
  guests: number;
  rooms: readonly Readonly<{ id: string; name: string; slug: string }>[];
  selectedRoom?: string;
}>;

export class AvailabilitySearchInputError extends Error {
  readonly code = "INVALID_AVAILABILITY_SEARCH" as const;
}

export class SelectedRoomUnavailableError extends Error {
  readonly code = "SELECTED_ROOM_UNAVAILABLE" as const;
}

function parseGuests(value: unknown) {
  const guests = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(guests) || guests <= 0) {
    throw new AvailabilitySearchInputError(
      "Indica una cantidad válida de huéspedes."
    );
  }
  return guests;
}

/** Server-authoritative, read-only availability filtering. */
export async function searchAvailability(
  candidate: Readonly<{
    checkIn?: unknown;
    checkOut?: unknown;
    guests?: unknown;
    room?: unknown;
  }>,
  dependencies: Readonly<{
    availabilityRepository: AvailabilityRepository;
    roomSource: RoomReadSource;
  }>,
  now: Date = new Date()
): Promise<AvailabilitySearchResult> {
  let interval;
  try {
    interval = createLodgingInterval(
      String(candidate.checkIn ?? ""),
      String(candidate.checkOut ?? "")
    );
  } catch {
    throw new AvailabilitySearchInputError(
      "Selecciona fechas de entrada y salida válidas."
    );
  }
  const minimums = publicAvailabilityDateMinimums(now);
  if (compareLodgingDates(interval.checkIn, minimums.checkIn) < 0) {
    throw new AvailabilitySearchInputError(
      "La fecha de entrada no puede ser anterior a hoy."
    );
  }
  if (compareLodgingDates(interval.checkOut, minimums.checkOut) < 0) {
    throw new AvailabilitySearchInputError(
      "La fecha de salida debe ser como mínimo mañana."
    );
  }
  const guests = parseGuests(candidate.guests);
  const selected =
    typeof candidate.room === "string" && candidate.room.trim()
      ? candidate.room.trim()
      : undefined;
  const rooms = dependencies.roomSource.listActive();
  const selectedRoom = selected
    ? rooms.find((room) => room.slug === selected || room.id === selected)
    : undefined;
  if (selected && !selectedRoom) {
    throw new SelectedRoomUnavailableError(
      "La habitación seleccionada no está disponible para reservar."
    );
  }
  const candidates = selectedRoom ? [selectedRoom] : rooms;
  const available = await Promise.all(
    candidates.map(async (room) => ({
      room,
      result: checkRoomAvailability(
        await dependencies.availabilityRepository.listOccupyingIntervals(
          room.id
        ),
        interval
      ),
    }))
  );
  if (selectedRoom && !available[0]?.result.available) {
    throw new SelectedRoomUnavailableError(
      "La habitación seleccionada no está disponible para esas fechas."
    );
  }
  return Object.freeze({
    checkIn: interval.checkIn,
    checkOut: interval.checkOut,
    guests,
    rooms: Object.freeze(
      available
        .filter(({ result }) => result.available)
        .map(({ room }) =>
          Object.freeze({ id: room.id, name: room.name, slug: room.slug })
        )
    ),
    selectedRoom: selected,
  });
}
