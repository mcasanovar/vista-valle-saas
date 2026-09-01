import { z } from "zod";
import type { RoomReadModel } from "@/features/rooms";
import { createLodgingInterval } from "@/features/availability";

export const unsupportedAssistantActions = Object.freeze([
  "CANCEL_RESERVATION",
  "CHANGE_PRICE",
  "CHANGE_PAYMENT",
  "ARBITRARY_SQL",
] as const);
export type CreateRoomBlockProposal = Readonly<{
  action: "CREATE_ROOM_BLOCK";
  roomId: string;
  checkIn: string;
  checkOut: string;
  reason: string;
}>;
const schema = z.object({
  action: z.literal("CREATE_ROOM_BLOCK"),
  room: z.string().trim().min(1),
  checkIn: z.string(),
  checkOut: z.string(),
  reason: z.string().trim().min(1).max(500),
});
export function parseCreateRoomBlockProposal(
  input: unknown,
  rooms: readonly RoomReadModel[]
): CreateRoomBlockProposal {
  const value = schema.parse(input);
  const room = rooms.find(
    (item) =>
      item.id === value.room ||
      item.slug === value.room ||
      item.name.toLowerCase() === value.room.toLowerCase()
  );
  if (!room) throw new Error("Unknown room");
  const interval = createLodgingInterval(value.checkIn, value.checkOut);
  return Object.freeze({
    action: "CREATE_ROOM_BLOCK",
    roomId: room.id,
    checkIn: interval.checkIn,
    checkOut: interval.checkOut,
    reason: value.reason,
  });
}
