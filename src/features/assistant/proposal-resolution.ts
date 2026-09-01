import { createLodgingInterval, nights } from "@/features/availability";
import type { RoomReadModel } from "@/features/rooms";
export type ResolvedBlockProposal = Readonly<{
  roomId: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  expiresAt: Date;
}>;
export function missingProposalFields(value: Record<string, unknown>) {
  return ["room", "checkIn", "checkOut", "reason"].filter((key) => !value[key]);
}
export function resolveRoomAlias(
  alias: string,
  rooms: readonly RoomReadModel[]
) {
  return (
    rooms.find((room) =>
      [room.id, room.slug, room.name].some(
        (value) => value.toLowerCase() === alias.trim().toLowerCase()
      )
    ) ?? null
  );
}
export function resolveBlockProposal(
  value: { room: string; checkIn: string; checkOut: string; reason: string },
  rooms: readonly RoomReadModel[],
  now: Date = new Date(),
  ttlMinutes = 15
): ResolvedBlockProposal {
  const room = resolveRoomAlias(value.room, rooms);
  if (!room) throw new Error("Unknown room");
  if (
    /^\d{1,2}\/\d{1,2}$/.test(value.checkIn) ||
    /^\d{1,2}\/\d{1,2}$/.test(value.checkOut) ||
    /hoy|mañana/i.test(value.checkIn + value.checkOut)
  )
    throw new Error("Absolute year is required");
  const interval = createLodgingInterval(value.checkIn, value.checkOut);
  return Object.freeze({
    roomId: room.id,
    checkIn: interval.checkIn,
    checkOut: interval.checkOut,
    nights: nights(interval.checkIn, interval.checkOut),
    expiresAt: new Date(now.getTime() + ttlMinutes * 60000),
  });
}
export function isProposalExpired(
  proposal: ResolvedBlockProposal,
  now: Date = new Date()
) {
  return proposal.expiresAt <= now;
}
