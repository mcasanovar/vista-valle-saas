import "server-only";

import { and, desc, eq } from "drizzle-orm";

import { getServerEnvironment } from "@/config/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { assistantInteractions } from "@/persistence/schema";
import type { ProductionDatabase } from "@/infrastructure/database/client";

/**
 * What a proposal is about, generalized to any write operation (design.md
 * decision 4: "La operación concreta viaja dentro de `interpretation`, así
 * que no se requiere migración de enum"). `operation` is one of the write
 * tool names (`crear_reserva`, `editar_fechas`, `cambiar_estado`,
 * `registrar_cobro`, `crear_bloqueo`, `eliminar_bloqueo`); `payload` is
 * whatever that tool's handler resolved from the model's arguments.
 */
export type AssistantInterpretation = Readonly<{
  operation: string;
  payload: Readonly<Record<string, unknown>>;
}>;

export type AssistantExecutionResult = Readonly<{
  code?: string;
  data?: Readonly<Record<string, unknown>>;
  outcome: "executed" | "cancelled" | "failed";
}>;

export type AssistantInteractionAuditEntry = Readonly<{
  actor: string;
  approvedAt?: Date;
  cancelledAt?: Date;
  corrections: readonly string[];
  createdAt: Date;
  executedAt?: Date;
  expiresAt: Date;
  id: string;
  instruction: string;
  interpretation: AssistantInterpretation;
  result?: AssistantExecutionResult;
  status: "previewed" | "approved" | "cancelled" | "executed" | "expired" | "failed";
}>;

type StoredAssistantInteraction = AssistantInteractionAuditEntry & {
  proposalToken: string;
};

type CreateAssistantInteractionInput = Readonly<{
  actor: string;
  corrections?: readonly string[];
  instruction: string;
  interpretation: AssistantInterpretation;
  proposalToken: string;
  /** Defaults to `ASSISTANT_PROPOSAL_TTL_MINUTES`. */
  ttlMinutes?: number;
}>;

export class AssistantProposalNotFoundError extends Error {
  constructor() {
    super("Assistant proposal not found");
    this.name = "AssistantProposalNotFoundError";
  }
}

export class AssistantProposalExpiredError extends Error {
  constructor() {
    super("Assistant proposal has expired");
    this.name = "AssistantProposalExpiredError";
  }
}

export class AssistantProposalAlreadyResolvedError extends Error {
  constructor() {
    super("Assistant proposal has already been confirmed or cancelled");
    this.name = "AssistantProposalAlreadyResolvedError";
  }
}

function defaultTtlMinutes() {
  return getServerEnvironment().ASSISTANT_PROPOSAL_TTL_MINUTES;
}

function expiresAtFrom(ttlMinutes: number | undefined, now: Date) {
  return new Date(now.getTime() + (ttlMinutes ?? defaultTtlMinutes()) * 60_000);
}

// A plain module-level array would not survive Next.js dev mode
// instantiating this module more than once (e.g. once for a route
// handler's module graph, once for a server action's) — the propose and
// confirm steps would then each see their own empty array. `globalThis`,
// keyed by a well-known symbol, is shared across every such instance,
// matching the pattern already used by `manual-blocks.ts`'s mock store.
const mockInteractionsKey = Symbol.for("vista-valle.mock.assistant-interactions");

function getInteractions() {
  const scope = globalThis as typeof globalThis & {
    [key: symbol]: StoredAssistantInteraction[] | undefined;
  };
  return (scope[mockInteractionsKey] ??= []);
}

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
    expiresAt: interaction.expiresAt,
    id: interaction.id,
    instruction: interaction.instruction,
    interpretation: interaction.interpretation,
    result: interaction.result,
    status: interaction.status,
  });
}

function findInteraction(proposalToken: string, actor: string) {
  const interaction = getInteractions().find(
    (candidate) =>
      candidate.proposalToken === proposalToken && candidate.actor === actor
  );
  if (!interaction) throw new AssistantProposalNotFoundError();
  return interaction;
}

/** Throws if the proposal is expired or already resolved; marks it `expired` in place the first time expiry is observed. */
function assertPending(interaction: StoredAssistantInteraction, now: Date) {
  if (interaction.status === "expired") throw new AssistantProposalExpiredError();
  if (interaction.status !== "previewed")
    throw new AssistantProposalAlreadyResolvedError();
  if (interaction.expiresAt <= now) {
    replaceInteraction(interaction, { status: "expired" });
    throw new AssistantProposalExpiredError();
  }
}

function replaceInteraction(
  current: StoredAssistantInteraction,
  changes: Partial<StoredAssistantInteraction>
) {
  const next = Object.freeze({ ...current, ...changes });
  const list = getInteractions();
  list.splice(list.indexOf(current), 1, next);
  return next;
}

/**
 * Maps a persisted row's `assistant_interaction_status` (`proposed` |
 * `confirmed` | `cancelled` | `failed` | `expired`) onto this module's
 * audit vocabulary (`previewed` | `approved` | `cancelled` | `executed` |
 * `expired` | `failed`). The two don't line up one-to-one: confirming and
 * executing a proposal happen in the same request in production (design.md
 * decision 4), so `confirmed` means "approved" until `executedAt` is set,
 * at which point it means "executed".
 */
function toAuditEntryFromRow(
  row: typeof assistantInteractions.$inferSelect
): AssistantInteractionAuditEntry {
  const status: AssistantInteractionAuditEntry["status"] =
    row.status === "proposed"
      ? "previewed"
      : row.status === "expired"
        ? "expired"
        : row.status === "cancelled"
          ? "cancelled"
          : row.status === "failed"
            ? "failed"
            : row.executedAt
              ? "executed"
              : "approved";

  return Object.freeze({
    actor: row.actorUserId,
    approvedAt:
      status === "approved" || status === "executed"
        ? row.updatedAt
        : undefined,
    cancelledAt: status === "cancelled" ? row.updatedAt : undefined,
    corrections: Object.freeze([
      ...((row.corrections as readonly string[] | null) ?? []),
    ]),
    createdAt: row.createdAt,
    executedAt: row.executedAt ?? undefined,
    expiresAt: row.expiresAt ?? row.createdAt,
    id: row.id,
    instruction: row.instruction,
    interpretation: row.interpretation as AssistantInterpretation,
    result: (row.result as AssistantExecutionResult | null) ?? undefined,
    status,
  });
}

export function createDrizzleAssistantInteractionAudit(db: ProductionDatabase) {
  async function findRow(proposalToken: string, actor: string) {
    const [row] = await db
      .select()
      .from(assistantInteractions)
      .where(
        and(
          eq(assistantInteractions.proposalToken, proposalToken),
          eq(assistantInteractions.actorUserId, actor)
        )
      );
    if (!row) throw new AssistantProposalNotFoundError();
    return row;
  }

  /** Throws if expired or already resolved; persists the `expired` transition the first time it's observed. */
  async function assertPendingRow(
    row: typeof assistantInteractions.$inferSelect,
    now: Date
  ) {
    if (row.status === "expired") throw new AssistantProposalExpiredError();
    if (row.status !== "proposed")
      throw new AssistantProposalAlreadyResolvedError();
    if (row.expiresAt && row.expiresAt <= now) {
      await db
        .update(assistantInteractions)
        .set({ status: "expired" })
        .where(eq(assistantInteractions.id, row.id));
      throw new AssistantProposalExpiredError();
    }
  }

  return Object.freeze({
    async create(input: CreateAssistantInteractionInput) {
      const now = new Date();
      const [row] = await db
        .insert(assistantInteractions)
        .values({
          actorUserId: input.actor,
          corrections: [...(input.corrections ?? [])],
          expiresAt: expiresAtFrom(input.ttlMinutes, now),
          instruction: input.instruction,
          interpretation: { ...input.interpretation },
          proposalToken: input.proposalToken,
          status: "proposed",
        })
        .returning();
      return toAuditEntryFromRow(row!);
    },
    async approve(proposalToken: string, actor: string) {
      const current = await findRow(proposalToken, actor);
      await assertPendingRow(current, new Date());
      const [row] = await db
        .update(assistantInteractions)
        .set({ status: "confirmed" })
        .where(eq(assistantInteractions.id, current.id))
        .returning();
      return toAuditEntryFromRow(row!);
    },
    async cancel(proposalToken: string, actor: string) {
      const current = await findRow(proposalToken, actor);
      await assertPendingRow(current, new Date());
      const [row] = await db
        .update(assistantInteractions)
        .set({ result: { outcome: "cancelled" }, status: "cancelled" })
        .where(eq(assistantInteractions.id, current.id))
        .returning();
      return toAuditEntryFromRow(row!);
    },
    async recordExecutionResult(
      proposalToken: string,
      actor: string,
      result: AssistantExecutionResult
    ) {
      const current = await findRow(proposalToken, actor);
      if (current.status !== "confirmed")
        throw new AssistantProposalAlreadyResolvedError();
      const [row] = await db
        .update(assistantInteractions)
        .set({
          executedAt: new Date(),
          result: { ...result },
          status: result.outcome === "executed" ? "confirmed" : "failed",
        })
        .where(eq(assistantInteractions.id, current.id))
        .returning();
      return toAuditEntryFromRow(row!);
    },
    async list() {
      const rows = await db
        .select()
        .from(assistantInteractions)
        .orderBy(desc(assistantInteractions.createdAt));
      return Object.freeze(rows.map(toAuditEntryFromRow));
    },
  });
}

export function getAssistantInteractionAudit() {
  const boundary = createDatabaseBoundary();
  if (boundary.context === "production") {
    return createDrizzleAssistantInteractionAudit(
      createProductionDatabase(boundary)
    );
  }
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return null;

  return Object.freeze({
    // Kept `async` (despite being in-memory) so the mock branch's shape
    // matches the Postgres-backed branch's — every caller awaits either.
    async create(input: CreateAssistantInteractionInput) {
      const now = new Date();
      const created = Object.freeze({
        actor: input.actor,
        corrections: Object.freeze([...(input.corrections ?? [])]),
        createdAt: now,
        expiresAt: expiresAtFrom(input.ttlMinutes, now),
        id: crypto.randomUUID(),
        instruction: input.instruction,
        interpretation: Object.freeze({ ...input.interpretation }),
        proposalToken: input.proposalToken,
        status: "previewed" as const,
      });
      getInteractions().push(created);
      return toAuditEntry(created);
    },
    async approve(proposalToken: string, actor: string) {
      const current = findInteraction(proposalToken, actor);
      assertPending(current, new Date());
      return toAuditEntry(
        replaceInteraction(current, {
          approvedAt: new Date(),
          status: "approved",
        })
      );
    },
    async cancel(proposalToken: string, actor: string) {
      const current = findInteraction(proposalToken, actor);
      assertPending(current, new Date());
      return toAuditEntry(
        replaceInteraction(current, {
          cancelledAt: new Date(),
          result: Object.freeze({ outcome: "cancelled" as const }),
          status: "cancelled",
        })
      );
    },
    async recordExecutionResult(
      proposalToken: string,
      actor: string,
      result: AssistantExecutionResult
    ) {
      const current = findInteraction(proposalToken, actor);
      if (current.status !== "approved")
        throw new AssistantProposalAlreadyResolvedError();
      return toAuditEntry(
        replaceInteraction(current, {
          executedAt: new Date(),
          result: Object.freeze({ ...result }),
          status: result.outcome === "executed" ? "executed" : "failed",
        })
      );
    },
    async list() {
      return Object.freeze(getInteractions().map(toAuditEntry));
    },
  });
}
