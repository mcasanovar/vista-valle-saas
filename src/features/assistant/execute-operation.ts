import "server-only";

import {
  collectPayAtPropertyWithResult,
  createManualReservationFromInputResolved,
  editAdminReservationDatesWithResult,
  markPaymentPaidWithResult,
  transitionAdminReservationWithResult,
  type ManualReservationInput,
} from "@/features/admin";
import { createRoomBlocks, removeRoomBlock } from "@/features/room-blocks";

export class UnknownAssistantOperationError extends Error {
  constructor(operation: string) {
    super(`Unknown assistant operation: ${operation}`);
    this.name = "UnknownAssistantOperationError";
  }
}

async function executeCreateReservation(
  payload: Record<string, unknown>,
  actorUserId: string
) {
  const result = await createManualReservationFromInputResolved(
    payload as unknown as ManualReservationInput,
    actorUserId
  );
  return { reservationId: result.reservation.id };
}

async function executeEditDates(
  payload: Record<string, unknown>,
  actorUserId: string
) {
  const input = payload as Readonly<{
    checkIn: string;
    checkOut: string;
    reservationId: string;
  }>;
  const result = await editAdminReservationDatesWithResult({
    actorUserId,
    checkIn: input.checkIn,
    checkOut: input.checkOut,
    reservationId: input.reservationId,
  });
  if (!result.ok) throw new Error(result.message);
  return { reservationId: input.reservationId };
}

async function executeChangeStatus(
  payload: Record<string, unknown>,
  actorUserId: string
) {
  const input = payload as Readonly<{
    reservationId: string;
    to: "cancelled" | "completed" | "no_show";
  }>;
  const result = await transitionAdminReservationWithResult({
    actorUserId,
    reservationId: input.reservationId,
    to: input.to,
  });
  if (!result.ok) throw new Error(result.message);
  return { reservationId: result.reservation.id, status: result.reservation.status };
}

async function executeCollectPayment(
  payload: Record<string, unknown>,
  actorUserId: string
) {
  const input = payload as Readonly<{
    amountClp: number;
    collectedOn: string;
    medium: string;
    paymentId?: string;
    reservationId: string;
  }>;
  if (input.paymentId) {
    const result = await markPaymentPaidWithResult({
      paymentId: input.paymentId,
      recordedByUserId: actorUserId,
    });
    if (!result.ok) throw new Error(result.message);
    return { paymentId: input.paymentId };
  }
  const result = await collectPayAtPropertyWithResult({
    amountClp: input.amountClp,
    collectedOn: input.collectedOn,
    medium: input.medium,
    recordedByUserId: actorUserId,
    reservationId: input.reservationId,
  });
  if (!result.ok) throw new Error(result.message);
  return { reservationId: input.reservationId };
}

async function executeCreateBlock(
  payload: Record<string, unknown>,
  actorUserId: string
) {
  const input = payload as Readonly<{
    checkIn: string;
    checkOut: string;
    reason: string;
    roomIds: readonly string[];
  }>;
  const blocks = await createRoomBlocks(input, actorUserId);
  return { blockIds: blocks.map((block) => block.id) };
}

async function executeRemoveBlock(
  payload: Record<string, unknown>,
  actorUserId: string
) {
  const input = payload as Readonly<{ blockId: string }>;
  const block = await removeRoomBlock(input.blockId, actorUserId);
  return { blockId: block.id };
}

/**
 * The single place a write-lane operation is actually carried out —
 * called only from `confirmAssistantProposalAction`, never from the agent
 * loop (design.md decision 2; verified in task 6.10). Every branch ends in
 * the same domain function the equivalent admin screen uses.
 */
export async function executeAssistantOperation(
  operation: string,
  payload: Readonly<Record<string, unknown>>,
  actorUserId: string
): Promise<Readonly<Record<string, unknown>>> {
  switch (operation) {
    case "crear_reserva":
      return executeCreateReservation(payload, actorUserId);
    case "editar_fechas":
      return executeEditDates(payload, actorUserId);
    case "cambiar_estado":
      return executeChangeStatus(payload, actorUserId);
    case "registrar_cobro":
      return executeCollectPayment(payload, actorUserId);
    case "crear_bloqueo":
      return executeCreateBlock(payload, actorUserId);
    case "eliminar_bloqueo":
      return executeRemoveBlock(payload, actorUserId);
    default:
      throw new UnknownAssistantOperationError(operation);
  }
}
