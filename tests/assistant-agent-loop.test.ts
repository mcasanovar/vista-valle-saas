import { describe, expect, it } from "vitest";
import { z } from "zod";

import { runAssistantAgentLoop } from "@/features/assistant/agent-loop";
import { createScriptedAssistantModel } from "@/features/assistant/assistant-model-mock";
import {
  createAssistantToolRegistry,
  type AssistantToolInvocationContext,
  type AnyAssistantToolDefinition,
} from "@/features/assistant/tool-registry";

const context: AssistantToolInvocationContext = Object.freeze({
  actorUserId: "admin-1",
  operationalContext: Object.freeze({
    rooms: [],
    today: "2030-01-01",
    validManualOrigins: [],
    validReservationStatusTransitions: [],
    validRoomBlockStatuses: [],
  }),
});

function echoReadTool(): AnyAssistantToolDefinition {
  return {
    description: "Echoes its input back.",
    async handler(input: unknown) {
      return { echoed: input };
    },
    lane: "read",
    name: "eco",
    schema: z.object({ value: z.string().optional() }),
  };
}

describe("assistant agent loop", () => {
  it("returns the model's text once it stops requesting tools", async () => {
    const model = createScriptedAssistantModel([
      { kind: "text", text: "No encontré reservas para esas fechas." },
    ]);
    const registry = createAssistantToolRegistry([echoReadTool()]);

    const result = await runAssistantAgentLoop(model, registry, context, {
      history: [],
      instruction: "Busca reservas de mañana",
      systemPrefix: "reglas",
    });

    expect(result).toMatchObject({
      reachedRoundLimit: false,
      text: "No encontré reservas para esas fechas.",
    });
  });

  it("dispatches a read tool call and feeds the result back as tool-role data", async () => {
    const model = createScriptedAssistantModel([
      {
        kind: "tool_calls",
        toolCalls: [{ id: "call-1", name: "eco", arguments: { value: "hola" } }],
      },
      { kind: "text", text: "Listo." },
    ]);
    const registry = createAssistantToolRegistry([echoReadTool()]);

    const result = await runAssistantAgentLoop(model, registry, context, {
      history: [],
      instruction: "prueba",
      systemPrefix: "reglas",
    });

    expect(result.text).toBe("Listo.");
    const toolMessage = result.appendedMessages.find((m) => m.role === "tool");
    expect(toolMessage).toBeDefined();
    expect(toolMessage!.content).toContain("hola");
  });

  it("stops at the round cap and offers to continue instead of looping forever (task 7.1)", async () => {
    const alwaysToolCall = {
      kind: "tool_calls" as const,
      toolCalls: [{ id: "call-x", name: "eco", arguments: {} }],
    };
    const model = createScriptedAssistantModel(
      Array.from({ length: 10 }, () => alwaysToolCall)
    );
    const registry = createAssistantToolRegistry([echoReadTool()]);

    const result = await runAssistantAgentLoop(model, registry, context, {
      history: [],
      instruction: "haz muchas cosas",
      maxRounds: 3,
      systemPrefix: "reglas",
    });

    expect(result.reachedRoundLimit).toBe(true);
    expect(result.text.toLowerCase()).toContain("continúe");
  });

  it("delivers a tool error as data instead of crashing the turn", async () => {
    const model = createScriptedAssistantModel([
      {
        kind: "tool_calls",
        toolCalls: [{ id: "call-1", name: "no_existe", arguments: {} }],
      },
      { kind: "text", text: "No pude hacer eso." },
    ]);
    const registry = createAssistantToolRegistry([echoReadTool()]);

    const result = await runAssistantAgentLoop(model, registry, context, {
      history: [],
      instruction: "intenta algo inexistente",
      systemPrefix: "reglas",
    });

    expect(result.text).toBe("No pude hacer eso.");
    const toolMessage = result.appendedMessages.find((m) => m.role === "tool");
    expect(toolMessage!.content).toContain("error");
  });
});
