import "server-only";

import { z } from "zod";

import type { AssistantToolDefinition } from "../../tool-registry";
import { proposeAssistantOperation } from "../../propose";

const schema = z.object({
  amountClp: z.number().int().positive(),
  collectedOn: z.string(),
  medium: z.string().min(1),
  reservationId: z.string().min(1),
});

export type CollectPaymentToolInput = z.infer<typeof schema>;

export type CollectPaymentToolResult = Readonly<{
  expiresAt: string;
  success: true;
  token: string;
}>;

/**
 * `registrar_cobro` (task 6.8): proposes recording a pending
 * `pay_at_property` payment as received. Whether the payment is actually
 * in a collectible state is checked only at confirmation, inside
 * `collectPayAtPropertyWithResult` — proposing never touches data.
 */
export function createCollectPaymentTool(): AssistantToolDefinition<
  CollectPaymentToolInput,
  CollectPaymentToolResult
> {
  return Object.freeze({
    description:
      "Propone registrar el cobro de un pago presencial pendiente. No lo registra: genera una propuesta que el administrador debe confirmar.",
    lane: "write",
    async handler(input, context): Promise<CollectPaymentToolResult> {
      const receipt = await proposeAssistantOperation({
        actorUserId: context.actorUserId,
        operation: "registrar_cobro",
        payload: input,
      });
      return Object.freeze({ ...receipt, success: true as const });
    },
    name: "registrar_cobro",
    schema,
  });
}
