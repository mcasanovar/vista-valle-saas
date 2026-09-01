import "server-only";

import { getServerEnvironment } from "@/config/server";

export type AssistantInterpretation = Readonly<{
  action: "CREATE_ROOM_BLOCK";
  roomId: string;
  checkIn: string;
  checkOut: string;
  reason: string;
}>;

export type AssistantExecutionResult = Readonly<{
  outcome: "executed" | "cancelled" | "failed";
  blockId?: string;
  code?: "unavailable_or_conflict";
}>;

export type AssistantInteractionAuditEntry = Readonly<{
  id: string;
  actor: string;
  instruction: string;
  interpretation: AssistantInterpretation;
  corrections: readonly string[];
  status: "previewed" | "approved" | "cancelled" | "executed" | "failed";
  createdAt: Date;
  approvedAt?: Date;
  cancelledAt?: Date;
  executedAt?: Date;
  result?: AssistantExecutionResult;
}>;

type StoredAssistantInteraction = AssistantInteractionAuditEntry & {
  proposalToken: string;
};

type CreateAssistantInteractionInput = Readonly<{
  actor: string;
  instruction: string;
  interpretation: AssistantInterpretation;
  corrections?: readonly string[];
  proposalToken: string;
}>;

const interactions: StoredAssistantInteraction[] = [];

function toAuditEntry(
  interaction: StoredAssistantInteraction
): AssistantInteractionAuditEntry {
  return Object.freeze({
    actor: interaction.actor,
    approvedAt: interaction.approvedAt,
    cancelledAt: interaction.cancelledAt,
    corrections: Object.freeze([...interaction.corrections]),
    createdAt: interaction.createdAt,
    executedAt: interaction.executedAt,
    id: interaction.id,
    instruction: interaction.instruction,
    interpretation: interaction.interpretation,
    result: interaction.result,
    status: interaction.status,
  });
}

function findInteraction(proposalToken: string, actor: string) {
  const interaction = interactions.find(
    (candidate) =>
      candidate.proposalToken === proposalToken && candidate.actor === actor
  );
  if (!interaction) throw new Error("Assistant interaction unavailable");
  return interaction;
}

function replaceInteraction(
  current: StoredAssistantInteraction,
  changes: Partial<StoredAssistantInteraction>
) {
  const next = Object.freeze({ ...current, ...changes });
  interactions.splice(interactions.indexOf(current), 1, next);
  return next;
}

export function getAssistantInteractionAudit() {
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return null;

  return Object.freeze({
    create(input: CreateAssistantInteractionInput) {
      const created = Object.freeze({
        id: crypto.randomUUID(),
        actor: input.actor,
        instruction: input.instruction,
        interpretation: Object.freeze({ ...input.interpretation }),
        corrections: Object.freeze([...(input.corrections ?? [])]),
        status: "previewed" as const,
        createdAt: new Date(),
        proposalToken: input.proposalToken,
      });
      interactions.push(created);
      return toAuditEntry(created);
    },
    approve(proposalToken: string, actor: string) {
      const current = findInteraction(proposalToken, actor);
      if (current.status !== "previewed")
        throw new Error("Assistant interaction unavailable");
      return toAuditEntry(
        replaceInteraction(current, {
          status: "approved",
          approvedAt: new Date(),
        })
      );
    },
    cancel(proposalToken: string, actor: string) {
      const current = findInteraction(proposalToken, actor);
      if (current.status !== "previewed")
        throw new Error("Assistant interaction unavailable");
      return toAuditEntry(
        replaceInteraction(current, {
          status: "cancelled",
          cancelledAt: new Date(),
          result: Object.freeze({ outcome: "cancelled" }),
        })
      );
    },
    recordExecutionResult(
      proposalToken: string,
      actor: string,
      result: AssistantExecutionResult
    ) {
      const current = findInteraction(proposalToken, actor);
      if (current.status !== "approved")
        throw new Error("Assistant interaction unavailable");
      return toAuditEntry(
        replaceInteraction(current, {
          status: result.outcome === "executed" ? "executed" : "failed",
          executedAt: new Date(),
          result: Object.freeze({ ...result }),
        })
      );
    },
    list() {
      return Object.freeze(interactions.map(toAuditEntry));
    },
  });
}
