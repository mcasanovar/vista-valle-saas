import "server-only";

import { z } from "zod";

import type { AssistantModelToolDefinition } from "./assistant-model";
import type { AssistantOperationalContext } from "./operational-context";

/**
 * `memory` is a third lane, distinct from `write`: `registrar_hecho`
 * (task 10.1) directly mutates `assistant_memory_facts` with no proposal
 * or confirmation step — it isn't a booking/payment domain mutation, and
 * its correction mechanism is the memory view's edit/delete (task 10.3),
 * not a confirm card.
 */
export type AssistantToolLane = "memory" | "read" | "write";

export type AssistantToolInvocationContext = Readonly<{
  actorUserId: string;
  operationalContext: AssistantOperationalContext;
}>;

export type AssistantToolDefinition<TInput = unknown, TOutput = unknown> = Readonly<{
  description: string;
  handler: (
    input: TInput,
    context: AssistantToolInvocationContext
  ) => Promise<TOutput>;
  lane: AssistantToolLane;
  name: string;
  schema: z.ZodType<TInput>;
}>;

/** Widened for storage in a single registry; each tool's own `schema` still validates its own narrow `TInput` at invocation time. */
export type AnyAssistantToolDefinition = AssistantToolDefinition<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any
>;

export class UnknownAssistantToolError extends Error {
  constructor(name: string) {
    super(`Unknown assistant tool: ${name}`);
    this.name = "UnknownAssistantToolError";
  }
}

/**
 * Thrown by `invokeReadTool`/`invokeWriteTool` when asked for a tool that
 * exists but is on the other lane. This is the structural half of
 * design.md decision 2's guarantee: the agent loop (task 7.1) only ever
 * calls `invokeReadTool`, so there is no code path from it to a `write`
 * handler — asking for one by name here fails closed instead of running it.
 */
export class AssistantToolLaneMismatchError extends Error {
  constructor(name: string, expectedLane: AssistantToolLane) {
    super(`Assistant tool "${name}" is not on the "${expectedLane}" lane`);
    this.name = "AssistantToolLaneMismatchError";
  }
}

export class InvalidAssistantToolArgumentsError extends Error {
  readonly issues: readonly string[];

  constructor(name: string, issues: readonly string[]) {
    super(`Invalid arguments for assistant tool "${name}": ${issues.join("; ")}`);
    this.name = "InvalidAssistantToolArgumentsError";
    this.issues = issues;
  }
}

export type AssistantToolRegistry = Readonly<{
  invokeMemoryTool: (
    name: string,
    rawArguments: unknown,
    context: AssistantToolInvocationContext
  ) => Promise<unknown>;
  invokeReadTool: (
    name: string,
    rawArguments: unknown,
    context: AssistantToolInvocationContext
  ) => Promise<unknown>;
  invokeWriteTool: (
    name: string,
    rawArguments: unknown,
    context: AssistantToolInvocationContext
  ) => Promise<unknown>;
  list: () => readonly AnyAssistantToolDefinition[];
  modelToolDefinitions: () => readonly AssistantModelToolDefinition[];
}>;

export function createAssistantToolRegistry(
  tools: readonly AnyAssistantToolDefinition[]
): AssistantToolRegistry {
  const byName = new Map(tools.map((tool) => [tool.name, tool] as const));

  function findToolOnLane(name: string, lane: AssistantToolLane) {
    const tool = byName.get(name);
    if (!tool) throw new UnknownAssistantToolError(name);
    if (tool.lane !== lane) throw new AssistantToolLaneMismatchError(name, lane);
    return tool;
  }

  async function invoke(
    name: string,
    lane: AssistantToolLane,
    rawArguments: unknown,
    context: AssistantToolInvocationContext
  ) {
    const tool = findToolOnLane(name, lane);
    const parsed = tool.schema.safeParse(rawArguments);
    if (!parsed.success) {
      throw new InvalidAssistantToolArgumentsError(
        name,
        parsed.error.issues.map(
          (issue) => `${issue.path.join(".") || tool.name}: ${issue.message}`
        )
      );
    }
    return tool.handler(parsed.data, context);
  }

  return Object.freeze({
    invokeMemoryTool: (name, rawArguments, context) =>
      invoke(name, "memory", rawArguments, context),
    invokeReadTool: (name, rawArguments, context) =>
      invoke(name, "read", rawArguments, context),
    invokeWriteTool: (name, rawArguments, context) =>
      invoke(name, "write", rawArguments, context),
    list: () => Object.freeze([...tools]),
    modelToolDefinitions: () =>
      Object.freeze(
        tools.map((tool) =>
          Object.freeze({
            description: tool.description,
            name: tool.name,
            parameters: z.toJSONSchema(tool.schema) as Readonly<
              Record<string, unknown>
            >,
          })
        )
      ),
  });
}
