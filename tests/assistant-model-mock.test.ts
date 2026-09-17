import { describe, expect, it } from "vitest";

import {
  AssistantModelScriptExhaustedError,
  createScriptedAssistantModel,
} from "@/features/assistant/assistant-model-mock";
import type { AssistantModelTurnInput } from "@/features/assistant/assistant-model";

const noopInput: AssistantModelTurnInput = Object.freeze({
  messages: [],
  tools: [],
});

describe("scripted assistant model", () => {
  it("replays a text-only turn", async () => {
    const model = createScriptedAssistantModel([
      { kind: "text", text: "No encontré reservas para esas fechas." },
    ]);

    await expect(model.runTurn(noopInput)).resolves.toEqual({
      kind: "text",
      text: "No encontré reservas para esas fechas.",
    });
  });

  it("replays a turn that requests a tool call", async () => {
    const model = createScriptedAssistantModel([
      {
        kind: "tool_calls",
        toolCalls: [
          {
            id: "call-1",
            name: "buscar_disponibilidad",
            arguments: { checkIn: "2030-01-01", checkOut: "2030-01-03" },
          },
        ],
      },
    ]);

    const result = await model.runTurn(noopInput);
    expect(result).toEqual({
      kind: "tool_calls",
      toolCalls: [
        {
          id: "call-1",
          name: "buscar_disponibilidad",
          arguments: { checkIn: "2030-01-01", checkOut: "2030-01-03" },
        },
      ],
    });
  });

  it("replays turns in order across multiple calls, one per round", async () => {
    const model = createScriptedAssistantModel([
      {
        kind: "tool_calls",
        toolCalls: [
          { id: "call-1", name: "listar_reservas", arguments: {} },
        ],
      },
      { kind: "text", text: "Encontré 3 reservas confirmadas." },
    ]);

    const first = await model.runTurn(noopInput);
    const second = await model.runTurn(noopInput);
    expect(first.kind).toBe("tool_calls");
    expect(second).toEqual({
      kind: "text",
      text: "Encontré 3 reservas confirmadas.",
    });
  });

  it("throws once the script is exhausted, instead of looping silently", async () => {
    const model = createScriptedAssistantModel([
      { kind: "text", text: "Listo." },
    ]);

    await model.runTurn(noopInput);
    await expect(model.runTurn(noopInput)).rejects.toBeInstanceOf(
      AssistantModelScriptExhaustedError
    );
  });
});
