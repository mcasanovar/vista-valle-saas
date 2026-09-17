import "server-only";

import { z } from "zod";

import type { AssistantToolDefinition } from "../../tool-registry";
import { proposeAssistantOperation } from "../../propose";

const schema = z.object({
  checkIn: z.string(),
  checkOut: z.string(),
  reason: z.string().min(1),
  roomIds: z.array(z.string().min(1)).min(1),
});

export type CreateBlockToolInput = z.infer<typeof schema>;

export type CreateBlockToolResult = Readonly<{
  expiresAt: string;
  success: true;
  token: string;
}>;

/** `crear_bloqueo` (task 6.9): proposes blocking one or more rooms for a date range. Conflict with an existing reservation is only checked at confirmation, inside `createRoomBlocks`. */
export function createCreateBlockTool(): AssistantToolDefinition<
  CreateBlockToolInput,
  CreateBlockToolResult
> {
  return Object.freeze({
    description:
      "Propone bloquear una o más habitaciones para un rango de fechas. No las bloquea: genera una propuesta que el administrador debe confirmar.",
    lane: "write",
    async handler(input, context): Promise<CreateBlockToolResult> {
      const receipt = await proposeAssistantOperation({
        actorUserId: context.actorUserId,
        operation: "crear_bloqueo",
        payload: input,
      });
      return Object.freeze({ ...receipt, success: true as const });
    },
    name: "crear_bloqueo",
    schema,
  });
}
