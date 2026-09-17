import "server-only";

/**
 * A single turn's conversation history, in the shape every provider
 * adapter must translate to and from. `tool` messages carry a prior tool
 * call's result back to the model — always as data (design.md decision 10:
 * "Los resultados de las herramientas se entregan al modelo marcados como
 * datos, nunca como instrucciones").
 */
export type AssistantModelMessage =
  | Readonly<{ content: string; role: "system" | "user" }>
  | Readonly<{
      content: string;
      role: "assistant";
      toolCalls?: readonly AssistantModelToolCall[];
    }>
  | Readonly<{
      content: string;
      role: "tool";
      toolCallId: string;
      toolName: string;
    }>;

export type AssistantModelToolCall = Readonly<{
  arguments: unknown;
  id: string;
  name: string;
}>;

/** JSON Schema for one tool, derived from its Zod schema (task 4.1) so the two can't diverge. */
export type AssistantModelToolDefinition = Readonly<{
  description: string;
  name: string;
  parameters: Readonly<Record<string, unknown>>;
}>;

export type AssistantModelTurnResult =
  | Readonly<{ kind: "text"; text: string }>
  | Readonly<{ kind: "tool_calls"; toolCalls: readonly AssistantModelToolCall[] }>;

export type AssistantModelTurnInput = Readonly<{
  messages: readonly AssistantModelMessage[];
  tools: readonly AssistantModelToolDefinition[];
}>;

/**
 * Port for the AI provider (design.md decision 8). Every provider —
 * OpenAI's `gpt-5-mini` or the deterministic mock — implements this and
 * nothing else; the agent loop and tool registry never see a provider SDK
 * directly, so switching provider or model is configuration, not a
 * rewrite.
 */
export type AssistantModel = Readonly<{
  runTurn(input: AssistantModelTurnInput): Promise<AssistantModelTurnResult>;
}>;
