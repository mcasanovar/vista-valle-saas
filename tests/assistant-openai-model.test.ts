import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createOpenAiAssistantModel,
  OpenAiAssistantModelError,
} from "@/features/assistant/openai-assistant-model";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenAI assistant model adapter (task 11.1)", () => {
  it("translates a text response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          choices: [{ message: { content: "No encontré reservas." } }],
        }),
        ok: true,
      })
    );
    const model = createOpenAiAssistantModel("key", "gpt-5-mini");

    const result = await model.runTurn({ messages: [], tools: [] });

    expect(result).toEqual({ kind: "text", text: "No encontré reservas." });
  });

  it("translates a tool-call response, parsing the JSON arguments", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          choices: [
            {
              message: {
                tool_calls: [
                  {
                    function: {
                      arguments: '{"checkIn":"2030-01-01","checkOut":"2030-01-03"}',
                      name: "buscar_disponibilidad",
                    },
                    id: "call_1",
                  },
                ],
              },
            },
          ],
        }),
        ok: true,
      })
    );
    const model = createOpenAiAssistantModel("key", "gpt-5-mini");

    const result = await model.runTurn({ messages: [], tools: [] });

    expect(result).toEqual({
      kind: "tool_calls",
      toolCalls: [
        {
          arguments: { checkIn: "2030-01-01", checkOut: "2030-01-03" },
          id: "call_1",
          name: "buscar_disponibilidad",
        },
      ],
    });
  });

  it("sends tool messages and assistant tool-call turns in OpenAI's shape", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ choices: [{ message: { content: "Listo." } }] }),
      ok: true,
    });
    vi.stubGlobal("fetch", fetchMock);
    const model = createOpenAiAssistantModel("key", "gpt-5-mini");

    await model.runTurn({
      messages: [
        {
          content: "",
          role: "assistant",
          toolCalls: [{ arguments: { a: 1 }, id: "call_1", name: "eco" }],
        },
        { content: '{"ok":true}', role: "tool", toolCallId: "call_1", toolName: "eco" },
      ],
      tools: [],
    });

    const body = JSON.parse(fetchMock.mock.calls[0]![1].body as string);
    expect(body.messages).toEqual([
      {
        content: null,
        role: "assistant",
        tool_calls: [
          { function: { arguments: '{"a":1}', name: "eco" }, id: "call_1", type: "function" },
        ],
      },
      { content: '{"ok":true}', role: "tool", tool_call_id: "call_1" },
    ]);
  });

  it("throws a typed error on a failed request instead of returning a fabricated result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "upstream error",
      })
    );
    const model = createOpenAiAssistantModel("key", "gpt-5-mini");

    await expect(model.runTurn({ messages: [], tools: [] })).rejects.toBeInstanceOf(
      OpenAiAssistantModelError
    );
  });
});
