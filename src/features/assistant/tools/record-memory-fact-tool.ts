import "server-only";

import { z } from "zod";

import { getAssistantMemoryStore } from "../memory";
import type { AssistantToolDefinition } from "../tool-registry";

const schema = z.object({
  fact: z.string().trim().min(1),
});

export type RecordMemoryFactToolInput = z.infer<typeof schema>;

export type RecordMemoryFactToolResult =
  | Readonly<{ fact: string; success: true }>
  | Readonly<{ code: "unavailable"; message: string; success: false }>;

/**
 * `registrar_hecho` (task 10.1). The system prompt (prompt.ts) is what
 * restricts this to explicit administrator instructions — the tool itself
 * has no way to tell why the model called it, only that it did. It writes
 * exactly the text given, immediately, with no proposal step (memory
 * facts are corrected by editing/deleting them, not by confirming them).
 */
export function createRecordMemoryFactTool(): AssistantToolDefinition<
  RecordMemoryFactToolInput,
  RecordMemoryFactToolResult
> {
  return Object.freeze({
    description:
      "Registra un hecho en la memoria del asistente, únicamente cuando el administrador lo pide explícitamente (por ejemplo, un apodo para una habitación o un criterio operativo).",
    lane: "memory",
    async handler(input, context): Promise<RecordMemoryFactToolResult> {
      const store = getAssistantMemoryStore();
      if (!store) {
        return Object.freeze({
          code: "unavailable" as const,
          message: "La memoria del asistente no está disponible.",
          success: false as const,
        });
      }
      const created = await store.createFact(context.actorUserId, input.fact);
      return Object.freeze({ fact: created.fact, success: true as const });
    },
    name: "registrar_hecho",
    schema,
  });
}
