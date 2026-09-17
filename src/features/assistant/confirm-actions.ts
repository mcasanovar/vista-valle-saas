"use server";

import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/infrastructure/auth/authorization";

import { executeAssistantOperation } from "./execute-operation";
import { getAssistantInteractionAudit } from "./interaction-audit";

export type ConfirmAssistantProposalResult =
  | Readonly<{ data: Readonly<Record<string, unknown>>; ok: true }>
  | Readonly<{ message: string; ok: false }>;

function revalidateAffectedPaths() {
  revalidatePath("/admin/reservas");
  revalidatePath("/admin/calendario");
  revalidatePath("/admin/bloqueos");
}

/**
 * Generalizes `confirmRoomBlocksAction` to every write operation
 * (design.md decision 4): looks up the proposal by token, revalidates it
 * belongs to the caller and hasn't expired, and only then calls
 * `executeAssistantOperation` — which re-runs the same domain function the
 * equivalent admin screen uses, so anything that changed since the
 * proposal was created (a room double-booked, a payment already
 * collected) is caught here, not assumed away.
 */
export async function confirmAssistantProposalAction(
  token: string
): Promise<ConfirmAssistantProposalResult> {
  const session = await requireAdministrator();
  const audit = getAssistantInteractionAudit();
  if (!audit) throw new Error("Assistant unavailable");

  const approved = await audit.approve(token, session.user.id);

  try {
    const data = await executeAssistantOperation(
      approved.interpretation.operation,
      approved.interpretation.payload,
      session.user.id
    );
    await audit.recordExecutionResult(token, session.user.id, {
      data,
      outcome: "executed",
    });
    revalidateAffectedPaths();
    return Object.freeze({ data, ok: true as const });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No pudimos ejecutar la operación.";
    await audit.recordExecutionResult(token, session.user.id, {
      code: "execution_failed",
      outcome: "failed",
    });
    return Object.freeze({ message, ok: false as const });
  }
}

/** Generalizes `cancelBlockProposalAction`/`cancelRoomBlocksAction`'s cancel step to every write operation: never touches domain data. */
export async function cancelAssistantProposalAction(token: string): Promise<void> {
  const session = await requireAdministrator();
  const audit = getAssistantInteractionAudit();
  if (!audit) throw new Error("Assistant unavailable");
  await audit.cancel(token, session.user.id);
}
