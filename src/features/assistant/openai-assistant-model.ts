import "server-only";

import { writeStructuredLog } from "@/infrastructure/observability/sentry";

import type {
  AssistantModel,
  AssistantModelMessage,
  AssistantModelToolDefinition,
  AssistantModelTurnInput,
  AssistantModelTurnResult,
} from "./assistant-model";

export class OpenAiAssistantModelError extends Error {
  constructor(status: number, body: string) {
    super(`OpenAI chat completion request failed (${status}): ${body}`);
    this.name = "OpenAiAssistantModelError";
  }
}

type OpenAiChatMessage = Readonly<{
  content: string | null;
  role: string;
  tool_call_id?: string;
  tool_calls?: readonly Readonly<{
    function: Readonly<{ arguments: string; name: string }>;
    id: string;
    type: "function";
  }>[];
}>;

function toOpenAiMessages(
  messages: readonly AssistantModelMessage[]
): readonly OpenAiChatMessage[] {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        content: message.content,
        role: "tool",
        tool_call_id: message.toolCallId,
      };
    }
    if (message.role === "assistant" && message.toolCalls?.length) {
      return {
        content: message.content || null,
        role: "assistant",
        tool_calls: message.toolCalls.map((call) => ({
          function: {
            arguments: JSON.stringify(call.arguments),
            name: call.name,
          },
          id: call.id,
          type: "function" as const,
        })),
      };
    }
    return { content: message.content, role: message.role };
  });
}

function toOpenAiTools(tools: readonly AssistantModelToolDefinition[]) {
  return tools.map((tool) => ({
    function: {
      description: tool.description,
      name: tool.name,
      parameters: tool.parameters,
    },
    type: "function" as const,
  }));
}

/**
 * `AssistantModel` adapter for OpenAI's Chat Completions API (task 11.1),
 * used only when `AI_PROVIDER` is `"openai"` — the mock adapter (section
 * 3) still backs every other context, including the full test suite.
 * Uses `fetch` directly against the REST API, matching this codebase's
 * existing provider adapters (Resend, Fintoc, MercadoPago) rather than
 * adding an SDK dependency.
 */
export function createOpenAiAssistantModel(
  apiKey: string,
  model: string
): AssistantModel {
  return Object.freeze({
    async runTurn(input: AssistantModelTurnInput): Promise<AssistantModelTurnResult> {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        body: JSON.stringify({
          messages: toOpenAiMessages(input.messages),
          model,
          tools: input.tools.length ? toOpenAiTools(input.tools) : undefined,
        }),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });

      if (!response.ok) {
        throw new OpenAiAssistantModelError(response.status, await response.text());
      }

      const body = (await response.json()) as {
        choices?: readonly {
          message?: {
            content?: string | null;
            tool_calls?: readonly {
              function: { arguments: string; name: string };
              id: string;
            }[];
          };
        }[];
        usage?: { prompt_tokens_details?: { cached_tokens?: number } };
      };

      // Task 11.3's verification: cached_tokens is nonzero on a repeat
      // turn only if the stable prefix (prompt.ts) actually stayed
      // byte-identical between requests.
      const cachedTokens = body.usage?.prompt_tokens_details?.cached_tokens;
      if (typeof cachedTokens === "number") {
        writeStructuredLog("info", "assistant.prompt_cache", { cachedTokens });
      }

      const choice = body.choices?.[0]?.message;
      const toolCalls = choice?.tool_calls;
      if (toolCalls && toolCalls.length > 0) {
        return {
          kind: "tool_calls",
          toolCalls: toolCalls.map((call) => ({
            arguments: JSON.parse(call.function.arguments || "{}") as unknown,
            id: call.id,
            name: call.function.name,
          })),
        };
      }
      return { kind: "text", text: choice?.content ?? "" };
    },
  });
}
