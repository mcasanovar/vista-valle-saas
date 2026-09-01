import "server-only";

import {
  getAvailabilitySearchRepository,
  nights,
  searchAvailability,
  validateAvailabilityResultsQuery,
  type AvailabilityRepository,
} from "@/features/availability";
import { getRoomReadSource, type RoomReadSource } from "@/features/rooms";

export type PrebookingSearchParams = Readonly<
  Record<string, string | readonly string[] | undefined>
>;

export type PrebookingReviewDependencies = Readonly<{
  availabilityRepository: AvailabilityRepository;
  roomSource: RoomReadSource;
}>;

export type PrebookingReview =
  | Readonly<{ kind: "empty" }>
  | Readonly<{ kind: "stale"; message: string }>
  | Readonly<{
      kind: "ready";
      checkIn: string;
      checkOut: string;
      guests: number;
      nights: number;
      rooms: readonly Readonly<{
        id: string;
        name: string;
        nightlyPriceClp: number;
        slug: string;
        subtotalClp: number;
      }>[];
      totalClp: number;
    }>;

function selectedRoomKeys(params: PrebookingSearchParams) {
  const raw = params.rooms;
  if (raw !== undefined && typeof raw !== "string") return null;
  return [...new Set((raw ?? "").split(",").filter(Boolean))];
}

async function defaultDependencies(): Promise<PrebookingReviewDependencies> {
  return Object.freeze({
    availabilityRepository: getAvailabilitySearchRepository(),
    roomSource: await getRoomReadSource(),
  });
}

/**
 * Rebuilds the review exclusively from server-side room data and current
 * occupancy. No browser-provided price, subtotal, or availability is read.
 */
export async function composePrebookingReview(
  params: PrebookingSearchParams,
  dependencies?: PrebookingReviewDependencies
): Promise<PrebookingReview> {
  const resolvedDependencies = dependencies ?? (await defaultDependencies());
  const keys = selectedRoomKeys(params);
  if (keys?.length === 0) return Object.freeze({ kind: "empty" });
  if (!keys) {
    return Object.freeze({
      kind: "stale",
      message: "La selección de habitaciones no es válida.",
    });
  }

  const validation = validateAvailabilityResultsQuery({
    checkIn: params.checkIn,
    checkOut: params.checkOut,
    guests: params.guests,
  });
  if (!validation.ok) {
    return Object.freeze({
      kind: "stale",
      message: "Revisa las fechas y vuelve a consultar disponibilidad.",
    });
  }

  const selected = keys.map((key) =>
    resolvedDependencies.roomSource
      .listActive()
      .find((room) => room.id === key || room.slug === key)
  );
  if (selected.some((room) => !room)) {
    return Object.freeze({
      kind: "stale",
      message: "Una de las habitaciones seleccionadas ya no está disponible.",
    });
  }

  try {
    await Promise.all(
      selected.map((room) =>
        searchAvailability(
          { ...validation.value, room: room!.slug },
          resolvedDependencies
        )
      )
    );
  } catch {
    return Object.freeze({
      kind: "stale",
      message:
        "Una habitación ya no está disponible para estas fechas. Retírala o ajusta la estadía.",
    });
  }

  const stayNights = nights(
    validation.value.checkIn,
    validation.value.checkOut
  );
  const rooms = Object.freeze(
    selected.map((room) => {
      const value = room!;
      return Object.freeze({
        id: value.id,
        name: value.name,
        nightlyPriceClp: value.nightlyPriceClp,
        slug: value.slug,
        subtotalClp: value.nightlyPriceClp * stayNights,
      });
    })
  );
  return Object.freeze({
    kind: "ready",
    checkIn: validation.value.checkIn,
    checkOut: validation.value.checkOut,
    guests: validation.value.guests,
    nights: stayNights,
    rooms,
    totalClp: rooms.reduce((total, room) => total + room.subtotalClp, 0),
  });
}
