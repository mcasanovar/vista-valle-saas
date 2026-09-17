"use server";
import { revalidatePath } from "next/cache";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { createRoomBlocks } from "@/features/room-blocks";
import { getAssistantInteractionAudit } from "./interaction-audit";

function getAuditOrThrow() {
  const audit = getAssistantInteractionAudit();
  if (!audit) throw new Error("Assistant unavailable");
  return audit;
}

type CreateRoomBlockPayload = Readonly<{
  checkIn: string;
  checkOut: string;
  reason: string;
  roomId: string;
}>;

/**
 * Demo-scripted proposal (calendar-assistant's MVP scope, still
 * `CREATE_ROOM_BLOCK`-only per `AGENTS.md` until section 8 reactivates
 * `/admin/asistente` against the full tool surface in
 * `admin-assistant-operations`). The proposal is persisted like any other
 * assistant proposal (design.md decision 4); only the interpretation step
 * is hardcoded instead of coming from a real `AssistantModel` turn.
 */
export async function startBlockProposalAction(data: FormData) {
  const user = await requireAdministrator();
  const instruction = String(data.get("instruction") ?? "").trim();
  if (!instruction) throw new Error("Assistant unavailable");
  const payload: CreateRoomBlockPayload = {
    checkIn: "2044-01-01",
    checkOut: "2044-01-03",
    reason: "Mantenimiento programado",
    roomId: "demo-room-valle",
  };
  const correction = String(data.get("correction") ?? "").trim();
  const token = crypto.randomUUID();
  await getAuditOrThrow().create({
    actor: user.user.id,
    corrections: correction ? [correction] : [],
    instruction,
    interpretation: { operation: "crear_bloqueo", payload },
    proposalToken: token,
  });

  return Object.freeze({ token, ...payload });
}

export async function confirmBlockProposalAction(data: FormData) {
  const user = await requireAdministrator();
  const token = String(data.get("token") ?? "");
  const audit = getAuditOrThrow();
  const approved = await audit.approve(token, user.user.id);
  const payload = approved.interpretation.payload as CreateRoomBlockPayload;

  try {
    const [block] = await createRoomBlocks(
      {
        checkIn: payload.checkIn,
        checkOut: payload.checkOut,
        reason: payload.reason,
        roomIds: [payload.roomId],
      },
      user.user.id
    );
    await audit.recordExecutionResult(token, user.user.id, {
      data: { blockId: block!.id },
      outcome: "executed",
    });
    revalidatePath("/admin/asistente");
    revalidatePath("/admin/calendario");
    revalidatePath("/admin/bloqueos");
    return block;
  } catch {
    await audit.recordExecutionResult(token, user.user.id, {
      code: "unavailable_or_conflict",
      outcome: "failed",
    });
    throw new Error("Assistant unavailable");
  }
}

export async function cancelBlockProposalAction(data: FormData) {
  const user = await requireAdministrator();
  const token = String(data.get("token") ?? "");
  await getAuditOrThrow().cancel(token, user.user.id);
  revalidatePath("/admin/asistente");
}
