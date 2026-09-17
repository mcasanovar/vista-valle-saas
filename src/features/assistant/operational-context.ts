import "server-only";

import { lodgingToday } from "@/features/availability";
import type { RoomReadSource } from "@/features/rooms";

export type AssistantOperationalRoom = Readonly<{
  capacity: number;
  id: string;
  name: string;
  nightlyPriceClp: number;
}>;

/**
 * The system facts the assistant needs on every turn — current rooms,
 * valid statuses/origins, today's date — read fresh from the data source
 * on each session rather than learned (proposal.md "Memoria de
 * preferencias": "El contexto operativo del sistema... no es memoria").
 */
export type AssistantOperationalContext = Readonly<{
  /** `YYYY-MM-DD` in `America/Santiago` — day granularity only, so it stays stable within the prompt's cached prefix for the whole day (design.md decision 6). */
  today: string;
  rooms: readonly AssistantOperationalRoom[];
  validManualOrigins: readonly string[];
  validReservationStatusTransitions: readonly string[];
  validRoomBlockStatuses: readonly string[];
}>;

const VALID_MANUAL_ORIGINS = Object.freeze([
  "website",
  "airbnb",
  "booking",
  "phone",
  "whatsapp",
  "admin",
] as const);

/** The subset of `ReservationStatus` the assistant's `cambiar_estado` tool can transition a reservation to (proposal.md "Superficie de operaciones"). */
const VALID_RESERVATION_STATUS_TRANSITIONS = Object.freeze([
  "cancelled",
  "completed",
  "no_show",
] as const);

const VALID_ROOM_BLOCK_STATUSES = Object.freeze(["active", "removed"] as const);

export async function buildAssistantOperationalContext(
  roomSource: RoomReadSource,
  now: Date = new Date()
): Promise<AssistantOperationalContext> {
  const rooms = roomSource
    .listActive()
    .map((room) =>
      Object.freeze({
        capacity: room.capacity,
        id: room.id,
        name: room.name,
        nightlyPriceClp: room.nightlyPriceClp,
      })
    );

  return Object.freeze({
    rooms: Object.freeze(rooms),
    today: lodgingToday(now),
    validManualOrigins: VALID_MANUAL_ORIGINS,
    validReservationStatusTransitions: VALID_RESERVATION_STATUS_TRANSITIONS,
    validRoomBlockStatuses: VALID_ROOM_BLOCK_STATUSES,
  });
}
