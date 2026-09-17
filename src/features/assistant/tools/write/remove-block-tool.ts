import "server-only";

import { z } from "zod";

import type { AssistantToolDefinition } from "../../tool-registry";
import { proposeAssistantOperation } from "../../propose";

const schema = z.object({
  blockId: z.string().min(1),
});

export type RemoveBlockToolInput = z.infer<typeof schema>;

export type RemoveBlockToolResult = Readonly<{
  expiresAt: string;
  success: true;
  token: string;
}>;

/** `eliminar_bloqueo` (task 6.9): proposes removing a room block, freeing its dates. */
export function createRemoveBlockTool(): AssistantToolDefinition<
  RemoveBlockToolInput,
  RemoveBlockToolResult
> {
  return Object.freeze({
    description:
      "Propone eliminar un bloqueo de habitación, liberando sus fechas. No lo elimina: genera una propuesta que el administrador debe confirmar.",
    lane: "write",
    async handler(input, context): Promise<RemoveBlockToolResult> {
      const receipt = await proposeAssistantOperation({
        actorUserId: context.actorUserId,
        operation: "eliminar_bloqueo",
        payload: input,
      });
      return Object.freeze({ ...receipt, success: true as const });
    },
    name: "eliminar_bloqueo",
    schema,
  });
}
