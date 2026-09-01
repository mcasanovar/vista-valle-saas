import {
  checkRoomAvailability,
  createLodgingInterval,
  type AvailabilityRepository,
  type LodgingInterval,
} from "@/features/availability";
import type { RoomReadModel, RoomReadSource } from "@/features/rooms";
import type { CompanyQuotationRoomSelection } from "./quotation";

export type CompanyQuotationAvailableRoom = Readonly<{
  availableUnits: number;
  capacity: number;
  name: string;
  nightlyPriceClp: number;
  slug: string;
}>;

export type CompanyQuotationAvailabilityResult = Readonly<{
  checkIn: string;
  checkOut: string;
  coversGuestCount: boolean;
  guestCount: number;
  rooms: readonly CompanyQuotationAvailableRoom[];
  totalActiveRooms: number;
  totalAvailableCapacity: number;
  totalAvailableRooms: number;
}>;

export class CompanyQuotationAvailabilityInputError extends Error {
  readonly code = "INVALID_COMPANY_QUOTATION_AVAILABILITY_INPUT" as const;
}

function parseGuestCount(value: unknown) {
  const guestCount = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(guestCount) || guestCount <= 0) {
    throw new CompanyQuotationAvailabilityInputError(
      "Indica una cantidad válida de personas."
    );
  }
  return guestCount;
}

/**
 * Groups free rooms by `name` (the room "type"): the mock and production
 * inventory model each physical room as its own record with a unique slug,
 * not a type with a quantity field, so "how many units of this type are
 * free" is computed here at query time rather than stored anywhere.
 */
function groupByType(rooms: readonly RoomReadModel[]) {
  const byName = new Map<string, RoomReadModel[]>();
  for (const room of rooms) {
    const group = byName.get(room.name) ?? [];
    group.push(room);
    byName.set(room.name, group);
  }
  return Array.from(byName.values());
}

/**
 * Server-authoritative, read-only resolution of room availability for the
 * company quotation flow. Unlike `searchAvailability`, it never filters a
 * room out for having less capacity than `guestCount`: capacity here is
 * evaluated in aggregate across every free room, not per room.
 */
export async function resolveCompanyQuotationAvailability(
  candidate: Readonly<{ checkIn?: unknown; checkOut?: unknown; guestCount?: unknown }>,
  dependencies: Readonly<{
    availabilityRepository: AvailabilityRepository;
    roomSource: RoomReadSource;
  }>
): Promise<CompanyQuotationAvailabilityResult> {
  let interval: LodgingInterval;
  try {
    interval = createLodgingInterval(
      String(candidate.checkIn ?? ""),
      String(candidate.checkOut ?? "")
    );
  } catch {
    throw new CompanyQuotationAvailabilityInputError(
      "Selecciona fechas de entrada y salida válidas."
    );
  }
  const guestCount = parseGuestCount(candidate.guestCount);

  const activeRooms = dependencies.roomSource.listActive();
  const checks = await Promise.all(
    activeRooms.map(async (room) => ({
      free: checkRoomAvailability(
        await dependencies.availabilityRepository.listOccupyingIntervals(
          room.id
        ),
        interval
      ).available,
      room,
    }))
  );
  const freeRooms = checks
    .filter((entry) => entry.free)
    .map((entry) => entry.room);

  const rooms = Object.freeze(
    groupByType(freeRooms)
      .map((group) => {
        const [representative] = [...group].sort((a, b) =>
          a.slug.localeCompare(b.slug)
        );
        return Object.freeze({
          availableUnits: group.length,
          capacity: representative!.capacity,
          name: representative!.name,
          nightlyPriceClp: representative!.nightlyPriceClp,
          slug: representative!.slug,
        });
      })
      .sort((a, b) => a.name.localeCompare(b.name))
  );
  const totalAvailableRooms = rooms.reduce(
    (sum, room) => sum + room.availableUnits,
    0
  );
  const totalAvailableCapacity = rooms.reduce(
    (sum, room) => sum + room.capacity * room.availableUnits,
    0
  );

  return Object.freeze({
    checkIn: interval.checkIn,
    checkOut: interval.checkOut,
    coversGuestCount: totalAvailableCapacity >= guestCount,
    guestCount,
    rooms,
    totalActiveRooms: activeRooms.length,
    totalAvailableCapacity,
    totalAvailableRooms,
  });
}

export class CompanyQuotationAvailabilityExceededError extends Error {
  readonly code = "COMPANY_QUOTATION_AVAILABILITY_EXCEEDED" as const;

  constructor(
    readonly slug: string,
    readonly availableUnits: number
  ) {
    super(
      "La disponibilidad para una de las habitaciones seleccionadas cambió."
    );
    this.name = "CompanyQuotationAvailabilityExceededError";
  }
}

/**
 * Re-checks each requested line against availability resolved at submit
 * time (not the availability the client saw when the form was rendered),
 * closing the window between showing the step-2 form and the final
 * submission (see design.md decision 4).
 */
export function assertCompanyQuotationRoomsAvailable(
  rooms: readonly CompanyQuotationRoomSelection[],
  availability: CompanyQuotationAvailabilityResult
) {
  const availableUnitsBySlug = new Map(
    availability.rooms.map((room) => [room.slug, room.availableUnits])
  );
  for (const selection of rooms) {
    const availableUnits = availableUnitsBySlug.get(selection.slug) ?? 0;
    if (selection.quantity > availableUnits) {
      throw new CompanyQuotationAvailabilityExceededError(
        selection.slug,
        availableUnits
      );
    }
  }
}
