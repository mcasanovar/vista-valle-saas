import "server-only";

import type {
  AssistantModel,
  AssistantModelMessage,
} from "./assistant-model";
import type {
  AssistantToolInvocationContext,
  AssistantToolRegistry,
} from "./tool-registry";

const DEFAULT_MAX_ROUNDS = 6;

export type AgentLoopInput = Readonly<{
  history: readonly AssistantModelMessage[];
  instruction: string;
  maxRounds?: number;
  systemPrefix: string;
}>;

export type AgentLoopResult = Readonly<{
  /** Every message appended this turn (assistant tool-call turns, tool results, and the final assistant text) — for persisting to `assistant_messages`. */
  appendedMessages: readonly AssistantModelMessage[];
  reachedRoundLimit: boolean;
  text: string;
}>;

function toolResultContent(data: unknown): string {
  // Serialized and delivered via a `tool` role message: the model's system
  // prefix (prompt.ts) instructs it to treat this as data, never as an
  // instruction, regardless of what the data contains (design.md decision 10).
  try {
    return JSON.stringify(data);
  } catch {
    return JSON.stringify({ error: "Result could not be serialized" });
  }
}

/**
 * The agent loop (design.md decisions 1, 2, 9): repeatedly asks the model
 * for a turn, dispatches any tool calls it requests, and feeds the results
 * back — for at most `maxRounds` rounds. Each tool call is dispatched
 * according to the tool's own declared lane (never a model-supplied
 * hint): read-lane tools execute and return real data; write-lane tools
 * only ever build a proposal (task 6.10) — there is no round in this loop
 * that executes a domain mutation directly.
 */
export async function runAssistantAgentLoop(
  model: AssistantModel,
  registry: AssistantToolRegistry,
  context: AssistantToolInvocationContext,
  input: AgentLoopInput
): Promise<AgentLoopResult> {
  const maxRounds = input.maxRounds ?? DEFAULT_MAX_ROUNDS;
  const tools = registry.modelToolDefinitions();
  const laneByToolName = new Map(
    registry.list().map((tool) => [tool.name, tool.lane] as const)
  );

  const messages: AssistantModelMessage[] = [
    { content: input.systemPrefix, role: "system" },
    ...input.history,
    { content: input.instruction, role: "user" },
  ];
  const appendedMessages: AssistantModelMessage[] = [
    { content: input.instruction, role: "user" },
  ];

  for (let round = 0; round < maxRounds; round += 1) {
    const turn = await model.runTurn({ messages, tools });

    if (turn.kind === "text") {
      const assistantMessage: AssistantModelMessage = {
        content: turn.text,
        role: "assistant",
      };
      appendedMessages.push(assistantMessage);
      return Object.freeze({
        appendedMessages: Object.freeze(appendedMessages),
        reachedRoundLimit: false,
        text: turn.text,
      });
    }

    const assistantToolCallMessage: AssistantModelMessage = {
      content: "",
      role: "assistant",
      toolCalls: turn.toolCalls,
    };
    messages.push(assistantToolCallMessage);
    appendedMessages.push(assistantToolCallMessage);

    for (const call of turn.toolCalls) {
      const lane = laneByToolName.get(call.name);
      let data: unknown;
      try {
        data =
          lane === "write"
            ? await registry.invokeWriteTool(call.name, call.arguments, context)
            : lane === "memory"
              ? await registry.invokeMemoryTool(call.name, call.arguments, context)
              : await registry.invokeReadTool(call.name, call.arguments, context);
      } catch (error) {
        data = {
          error: error instanceof Error ? error.message : "Unknown tool error",
        };
      }
      const toolMessage: AssistantModelMessage = {
        content: toolResultContent(data),
        role: "tool",
        toolCallId: call.id,
        toolName: call.name,
      };
      messages.push(toolMessage);
      appendedMessages.push(toolMessage);
    }
  }

  const limitText =
    "Llegué al límite de pasos que puedo dar en un solo turno. Esto es lo que alcancé a averiguar — dime si quieres que continúe.";
  appendedMessages.push({ content: limitText, role: "assistant" });
  return Object.freeze({
    appendedMessages: Object.freeze(appendedMessages),
    reachedRoundLimit: true,
    text: limitText,
  });
}
