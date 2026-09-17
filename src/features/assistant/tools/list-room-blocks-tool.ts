import "server-only";

import { z } from "zod";

import { listRoomBlocks, RoomBlockInputError, type RoomBlockPage } from "@/features/room-blocks";

import type { AssistantToolDefinition } from "../tool-registry";

const schema = z.object({
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  reason: z.string().optional(),
  roomId: z.string().optional(),
  status: z.enum(["active", "removed", "all"]).default("active"),
});

export type ListRoomBlocksToolInput = z.infer<typeof schema>;

export type ListRoomBlocksToolResult =
  | Readonly<{
      items: RoomBlockPage["items"];
      page: number;
      pageSize: number;
      success: true;
      total: number;
    }>
  | Readonly<{ code: "invalid_input"; message: string; success: false }>;

/** `listar_bloqueos` (task 5.5): a thin adapter over `listRoomBlocks`. */
export function createListRoomBlocksTool(): AssistantToolDefinition<
  ListRoomBlocksToolInput,
  ListRoomBlocksToolResult
> {
  return Object.freeze({
    description: "Lista bloqueos de habitación, con filtro de estado, habitación y fechas.",
    async handler(input): Promise<ListRoomBlocksToolResult> {
      try {
        const result = await listRoomBlocks(input);
        return Object.freeze({ ...result, success: true as const });
      } catch (error) {
        if (error instanceof RoomBlockInputError) {
          return Object.freeze({
            code: "invalid_input" as const,
            message: error.message,
            success: false as const,
          });
        }
        throw error;
      }
    },
    lane: "read",
    name: "listar_bloqueos",
    schema,
  });
}
