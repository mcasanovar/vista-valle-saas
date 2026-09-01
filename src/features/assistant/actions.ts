"use server";
import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import {
  cancelBlockProposalToken,
  createBlockProposalToken,
  executeBlockProposalToken,
} from "./proposal-tokens";
import { getAssistantInteractionAudit } from "./interaction-audit";

function getAuditOrThrow() {
  const audit = getAssistantInteractionAudit();
  if (!audit) throw new Error("Assistant unavailable");
  return audit;
}

export async function startBlockProposalAction(data: FormData) {
  const user = await requireAdministrator();
  const instruction = String(data.get("instruction") ?? "").trim();
  if (!instruction) throw new Error("Assistant unavailable");
  const proposal = createBlockProposalToken({
    roomId: "demo-room-valle",
    checkIn: "2044-01-01",
    checkOut: "2044-01-03",
    reason: "Mantenimiento programado",
    actor: user.user.id,
  });
  const correction = String(data.get("correction") ?? "").trim();
  getAuditOrThrow().create({
    actor: user.user.id,
    instruction,
    interpretation: {
      action: "CREATE_ROOM_BLOCK",
      roomId: proposal.roomId,
      checkIn: proposal.checkIn,
      checkOut: proposal.checkOut,
      reason: proposal.reason,
    },
    corrections: correction ? [correction] : [],
    proposalToken: proposal.token,
  });

  return Object.freeze({
    token: proposal.token,
    roomId: proposal.roomId,
    checkIn: proposal.checkIn,
    checkOut: proposal.checkOut,
    reason: proposal.reason,
  });
}

export async function confirmBlockProposalAction(data: FormData) {
  const user = await requireAdministrator();
  const token = String(data.get("token") ?? "");
  const audit = getAuditOrThrow();
  audit.approve(token, user.user.id);

  try {
    const result = await executeBlockProposalToken(token, user.user.id);
    audit.recordExecutionResult(token, user.user.id, {
      outcome: "executed",
      blockId: result.id,
    });
    revalidatePath("/admin/asistente");
    revalidatePath("/admin/calendario");
    revalidatePath("/admin/bloqueos");
    return result;
  } catch {
    audit.recordExecutionResult(token, user.user.id, {
      outcome: "failed",
      code: "unavailable_or_conflict",
    });
    throw new Error("Assistant unavailable");
  }
}
export async function cancelBlockProposalAction(data: FormData) {
  const user = await requireAdministrator();
  const token = String(data.get("token") ?? "");
  const audit = getAuditOrThrow();
  const result = await cancelBlockProposalToken(token, user.user.id);
  audit.cancel(token, user.user.id);
  revalidatePath("/admin/asistente");
  return result;
}
