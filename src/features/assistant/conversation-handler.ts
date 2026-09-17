import "server-only";

import { runAssistantAgentLoop } from "./agent-loop";
import type { AssistantModel, AssistantModelMessage } from "./assistant-model";
import type { AssistantOperationalContext } from "./operational-context";
import { buildAssistantPromptPrefix } from "./prompt";
import type { AssistantToolRegistry } from "./tool-registry";
import type { AssistantThreadStore } from "./threads";

export type ConversationRequestInput = Readonly<{
  actorUserId: string;
  instruction: string;
  threadId?: string;
}>;

export type ConversationDependencies = Readonly<{
  maxRounds?: number;
  memoryFacts: readonly string[];
  model: AssistantModel;
  operationalContext: AssistantOperationalContext;
  registry: AssistantToolRegistry;
  threadStore: AssistantThreadStore;
}>;

/** A write-lane tool's proposal receipt, surfaced so the UI can render a confirmation card (proposal.md "tarjeta de confirmación") without parsing prose. */
export type ConversationProposal = Readonly<{
  operation: string;
  payload: Readonly<Record<string, unknown>>;
  token: string;
}>;

export type ConversationResponse =
  | Readonly<{
      kind: "ok";
      proposals: readonly ConversationProposal[];
      reachedRoundLimit: boolean;
      text: string;
      threadId: string;
    }>
  | Readonly<{ kind: "provider_failure"; message: string }>
  | Readonly<{ kind: "thread_not_found" }>;

/**
 * The route-independent core of the conversational turn (task 7.2): given
 * an already-authenticated actor and a resolved set of dependencies,
 * resolves the thread, runs the agent loop, and persists the turn — or
 * reports a provider failure without persisting anything (task 7.4:
 * "un error... no modifican datos"). `app/api/admin/assistant/route.ts` is
 * a thin adapter over this that handles authentication, request parsing,
 * and the HTTP response.
 */
export async function handleAssistantConversation(
  input: ConversationRequestInput,
  dependencies: ConversationDependencies
): Promise<ConversationResponse> {
  const existingThread = input.threadId
    ? await dependencies.threadStore.getThread(input.threadId, input.actorUserId)
    : null;
  if (input.threadId && !existingThread)
    return Object.freeze({ kind: "thread_not_found" as const });

  const history: readonly AssistantModelMessage[] = (existingThread?.messages ?? []).map(
    (message) => ({ content: message.content, role: message.role })
  );

  const systemPrefix = buildAssistantPromptPrefix({
    memoryFacts: dependencies.memoryFacts,
    operationalContext: dependencies.operationalContext,
    tools: dependencies.registry.modelToolDefinitions(),
  });

  let result;
  try {
    result = await runAssistantAgentLoop(
      dependencies.model,
      dependencies.registry,
      {
        actorUserId: input.actorUserId,
        operationalContext: dependencies.operationalContext,
      },
      {
        history,
        instruction: input.instruction,
        maxRounds: dependencies.maxRounds,
        systemPrefix,
      }
    );
  } catch {
    return Object.freeze({
      kind: "provider_failure" as const,
      message:
        "No pudimos completar tu instrucción en este momento. Intenta nuevamente en unos segundos.",
    });
  }

  // The thread row itself is only created once the turn actually
  // produced something to persist — a provider failure above leaves no
  // trace at all, not even an empty thread (task 7.4).
  const thread =
    existingThread ??
    (await dependencies.threadStore.createThread(
      input.actorUserId,
      input.instruction.slice(0, 80)
    ));

  await dependencies.threadStore.appendMessages(
    thread.id,
    input.actorUserId,
    result.appendedMessages.map((message) => ({
      content: message.content,
      role: message.role === "user" ? ("user" as const) : ("assistant" as const),
      toolActivity:
        message.role === "assistant" && message.toolCalls
          ? message.toolCalls
          : message.role === "tool"
            ? { toolCallId: message.toolCallId, toolName: message.toolName }
            : undefined,
    }))
  );

  return Object.freeze({
    kind: "ok" as const,
    proposals: extractProposals(result.appendedMessages),
    reachedRoundLimit: result.reachedRoundLimit,
    text: result.text,
    threadId: thread.id,
  });
}

/** Pulls out every write-tool call's proposal receipt from this turn's messages, pairing each `tool` result with the call that produced it by `toolCallId`. */
function extractProposals(
  messages: readonly AssistantModelMessage[]
): readonly ConversationProposal[] {
  const callsById = new Map<string, Readonly<{ arguments: unknown; name: string }>>();
  for (const message of messages) {
    if (message.role !== "assistant" || !message.toolCalls) continue;
    for (const call of message.toolCalls) {
      callsById.set(call.id, { arguments: call.arguments, name: call.name });
    }
  }

  const proposals: ConversationProposal[] = [];
  for (const message of messages) {
    if (message.role !== "tool") continue;
    const call = callsById.get(message.toolCallId);
    if (!call) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(message.content);
    } catch {
      continue;
    }
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      "token" in parsed &&
      typeof (parsed as { token: unknown }).token === "string" &&
      (parsed as { success?: unknown }).success === true
    ) {
      proposals.push({
        operation: call.name,
        payload: (call.arguments ?? {}) as Readonly<Record<string, unknown>>,
        token: (parsed as { token: string }).token,
      });
    }
  }
  return Object.freeze(proposals);
}
