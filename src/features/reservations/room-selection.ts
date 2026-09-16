import { resolveRoomNightlyPrice, type RoomReadModel, type RoomReadSource } from "@/features/rooms";

import { parseRoomSelectionParam } from "./room-selection-codec";

export type SelectedRoom = Readonly<{ guestCount: number; room: RoomReadModel }>;

/**
 * Resolves the untrusted `rooms` (or single `room`) form field into
 * authoritative rooms paired with the occupancy the visitor chose for each
 * one - see `room-occupancy-pricing` spec. A bare room key (no
 * `:<guestCount>`, the pre-occupancy shape, or the single-room `room`
 * field) defaults to 1 guest. An out-of-range guest count for a room's
 * capacity drops that room, surfacing as "unavailable" like any other
 * invalid selection.
 *
 * This is the single room-resolution function shared by every booking
 * path — pay at property and every online-payment provider (Fintoc,
 * Mercado Pago) — so a `rooms` value with occupancy suffixes
 * (`doble:2,matrimonial:1`) resolves identically and with the same
 * occupancy pricing everywhere (see `add-mercado-pago-checkout-pro`
 * design.md decision 3).
 */
export function selectedRooms(
  candidate: Record<string, unknown>,
  source: RoomReadSource
): readonly SelectedRoom[] {
  const raw = candidate.rooms ?? candidate.room ?? "";
  const entries = parseRoomSelectionParam(String(raw));
  return entries
    .map((entry) => {
      const room = source
        .listActive()
        .find((candidateRoom) => candidateRoom.id === entry.roomId || candidateRoom.slug === entry.roomId);
      if (!room) return null;
      if (entry.guestCount < 1 || entry.guestCount > room.capacity) return null;
      return Object.freeze({ guestCount: entry.guestCount, room });
    })
    .filter((entry): entry is SelectedRoom => entry !== null);
}

/** A `SelectedRoom` with its nightly price already resolved for its chosen occupancy. */
export type ResolvedSelectedRoom = Readonly<{
  capacity: number;
  guestCount: number;
  id: string;
  nightlyPriceClp: number;
}>;

export function toResolvedRoom(entry: SelectedRoom): ResolvedSelectedRoom {
  return Object.freeze({
    capacity: entry.room.capacity,
    guestCount: entry.guestCount,
    id: entry.room.id,
    nightlyPriceClp: resolveRoomNightlyPrice(
      entry.room,
      entry.room.occupancyPrices,
      entry.guestCount
    ),
  });
}
