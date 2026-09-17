import { describe, expect, it } from "vitest";
import { z } from "zod";

import { handleAssistantConversation } from "@/features/assistant/conversation-handler";
import { createScriptedAssistantModel } from "@/features/assistant/assistant-model-mock";
import { createAssistantToolRegistry } from "@/features/assistant/tool-registry";
import type { AnyAssistantToolDefinition } from "@/features/assistant/tool-registry";
import type { AssistantModel } from "@/features/assistant/assistant-model";
import { getAssistantThreadStore } from "@/features/assistant/threads";

const operationalContext = Object.freeze({
  rooms: [],
  today: "2030-01-01",
  validManualOrigins: [],
  validReservationStatusTransitions: [],
  validRoomBlockStatuses: [],
});

function echoReadTool(): AnyAssistantToolDefinition {
  return {
    description: "Echoes.",
    async handler(input: unknown) {
      return { echoed: input };
    },
    lane: "read",
    name: "eco",
    schema: z.object({}),
  };
}

function threadStore() {
  const instance = getAssistantThreadStore();
  if (!instance) throw new Error("Mock thread store is required for this test");
  return instance;
}

describe("handleAssistantConversation", () => {
  it("creates a new thread, runs the loop, and persists the turn", async () => {
    const model = createScriptedAssistantModel([
      { kind: "text", text: "Encontré 2 habitaciones disponibles." },
    ]);
    const registry = createAssistantToolRegistry([echoReadTool()]);

    const result = await handleAssistantConversation(
      { actorUserId: "admin-conv-1", instruction: "Busca disponibilidad" },
      { memoryFacts: [], model, operationalContext, registry, threadStore: threadStore() }
    );

    expect(result).toMatchObject({
      kind: "ok",
      text: "Encontré 2 habitaciones disponibles.",
    });
    if (result.kind !== "ok") return;
    const persisted = await threadStore().getThread(result.threadId, "admin-conv-1");
    expect(persisted!.messages.map((m) => m.content)).toEqual([
      "Busca disponibilidad",
      "Encontré 2 habitaciones disponibles.",
    ]);
  });

  it("rejects a threadId that doesn't belong to the actor", async () => {
    const other = await threadStore().createThread("admin-conv-owner");
    const model = createScriptedAssistantModel([{ kind: "text", text: "x" }]);
    const registry = createAssistantToolRegistry([echoReadTool()]);

    const result = await handleAssistantConversation(
      { actorUserId: "admin-conv-intruder", instruction: "hola", threadId: other.id },
      { memoryFacts: [], model, operationalContext, registry, threadStore: threadStore() }
    );

    expect(result).toEqual({ kind: "thread_not_found" });
  });

  it("reports a provider error as an actionable failure without persisting anything (task 7.4)", async () => {
    const failingModel: AssistantModel = {
      async runTurn() {
        throw new Error("upstream 500");
      },
    };
    const registry = createAssistantToolRegistry([echoReadTool()]);

    const result = await handleAssistantConversation(
      { actorUserId: "admin-conv-fail", instruction: "Cancela la reserva 1" },
      { memoryFacts: [], model: failingModel, operationalContext, registry, threadStore: threadStore() }
    );

    expect(result.kind).toBe("provider_failure");
    if (result.kind === "provider_failure") {
      expect(result.message.length).toBeGreaterThan(0);
    }
    const threads = await threadStore().listThreads("admin-conv-fail");
    expect(threads).toHaveLength(0);
  });

  it("reports a provider timeout the same way as any other provider error, without persisting anything", async () => {
    const timingOutModel: AssistantModel = {
      async runTurn() {
        throw new Error("Request timed out after 60000ms");
      },
    };
    const registry = createAssistantToolRegistry([echoReadTool()]);

    const result = await handleAssistantConversation(
      { actorUserId: "admin-conv-timeout", instruction: "Registra un cobro" },
      {
        memoryFacts: [],
        model: timingOutModel,
        operationalContext,
        registry,
        threadStore: threadStore(),
      }
    );

    expect(result.kind).toBe("provider_failure");
    const threads = await threadStore().listThreads("admin-conv-timeout");
    expect(threads).toHaveLength(0);
  });

  it("declines an instruction for an operation outside the declared tool surface without executing anything (task 7.5)", async () => {
    const model = createScriptedAssistantModel([
      {
        kind: "tool_calls",
        toolCalls: [
          { id: "call-1", name: "ejecutar_sql_arbitrario", arguments: {} },
        ],
      },
      {
        kind: "text",
        text: "No puedo ejecutar SQL directamente; solo puedo usar las operaciones disponibles.",
      },
    ]);
    const registry = createAssistantToolRegistry([echoReadTool()]);

    const result = await handleAssistantConversation(
      { actorUserId: "admin-conv-outofscope", instruction: "Ejecuta este SQL" },
      { memoryFacts: [], model, operationalContext, registry, threadStore: threadStore() }
    );

    expect(result).toMatchObject({
      kind: "ok",
      text: "No puedo ejecutar SQL directamente; solo puedo usar las operaciones disponibles.",
    });
  });
});
