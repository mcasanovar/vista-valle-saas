import { z } from "zod";

import { getServerEnvironment } from "@/config/server";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { getRoomReadSource } from "@/features/rooms";
import { buildAssistantOperationalContext } from "@/features/assistant/operational-context";
import { createAssistantToolRegistry } from "@/features/assistant/tool-registry";
import { createAllAssistantTools } from "@/features/assistant/tools";
import { getAssistantModel } from "@/features/assistant/model-provider";
import { getAssistantThreadStore } from "@/features/assistant/threads";
import { getAssistantMemoryStore } from "@/features/assistant/memory";
import { handleAssistantConversation } from "@/features/assistant/conversation-handler";

export const dynamic = "force-dynamic";
/**
 * The project's default `maxDuration` (60s) already covers this route —
 * declared explicitly anyway so lowering that default later can't silently
 * break the assistant's tool-round budget (design.md decision 9).
 */
export const maxDuration = 60;

const requestSchema = z.object({
  instruction: z.string().trim().min(1),
  threadId: z.string().optional(),
});

/**
 * The conversational turn endpoint (task 7.2). Authorization happens
 * first and unconditionally: an unauthenticated or non-administrator
 * request never reaches request parsing or the agent loop — nothing about
 * the instruction is interpreted before the session is verified.
 */
export async function POST(request: Request) {
  let session;
  try {
    session = await requireAdministrator();
  } catch {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!getServerEnvironment().ASSISTANT_ENABLED) {
    return Response.json({ error: "Asistente no disponible" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const threadStore = getAssistantThreadStore();
  if (!threadStore) {
    return Response.json({ error: "Asistente no disponible" }, { status: 503 });
  }

  const memoryStore = getAssistantMemoryStore();
  const [operationalContext, memoryFacts] = await Promise.all([
    buildAssistantOperationalContext(await getRoomReadSource()),
    memoryStore ? memoryStore.listFacts(session.user.id) : Promise.resolve([]),
  ]);
  const registry = createAssistantToolRegistry(createAllAssistantTools());

  const result = await handleAssistantConversation(
    {
      actorUserId: session.user.id,
      instruction: parsed.data.instruction,
      threadId: parsed.data.threadId,
    },
    {
      memoryFacts: memoryFacts.map((fact) => fact.fact),
      model: getAssistantModel(),
      operationalContext,
      registry,
      threadStore,
    }
  );

  if (result.kind === "thread_not_found") {
    return Response.json({ error: "Hilo no encontrado" }, { status: 404 });
  }
  if (result.kind === "provider_failure") {
    return Response.json({ error: result.message }, { status: 502 });
  }

  // Progressive delivery (design.md decision 9): the port doesn't stream
  // token deltas, so the assembled text is chunked here — enough that the
  // client sees the response arrive rather than a blank wait, without
  // requiring every `AssistantModel` adapter to support incremental
  // streaming.
  const encoder = new TextEncoder();
  const text = result.text;
  const chunkSize = 48;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let index = 0; index < text.length; index += chunkSize) {
        controller.enqueue(encoder.encode(text.slice(index, index + chunkSize)));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "X-Assistant-Proposals": Buffer.from(
        JSON.stringify(result.proposals),
        "utf-8"
      ).toString("base64"),
      "X-Assistant-Reached-Round-Limit": String(result.reachedRoundLimit),
      "X-Assistant-Thread-Id": result.threadId,
    },
  });
}
