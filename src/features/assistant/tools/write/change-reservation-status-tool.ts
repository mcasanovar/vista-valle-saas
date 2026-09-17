import "server-only";

import { z } from "zod";

import type { AssistantToolDefinition } from "../../tool-registry";
import { proposeAssistantOperation } from "../../propose";
import {
  createProductionViewReservationReader,
  type ViewReservationReader,
} from "../view-reservation-tool";

const schema = z.object({
  reservationId: z.string().min(1),
  to: z.enum(["cancelled", "completed", "no_show"]),
});

export type ChangeReservationStatusToolInput = z.infer<typeof schema>;

export type ReservationPaymentInfo = Readonly<{
  amountClp: number;
  status: string;
}>;

export type ChangeReservationStatusToolResult = Readonly<{
  expiresAt: string;
  /** Informational only (proposal.md "Cancelaciones sin reembolso") — never read back by the execution step. */
  paymentInfo?: readonly ReservationPaymentInfo[];
  success: true;
  token: string;
}>;

/**
 * `cambiar_estado` (task 6.6): proposes cancelling, completing, or marking
 * a reservation as a no-show. For a cancellation specifically, the current
 * payment status and amount are looked up and surfaced as informational
 * data on the proposal (task 6.7) — the payment status is never part of
 * what gets executed; `executeAssistantOperation` reads only
 * `reservationId` and `to` from this payload.
 */
export function createChangeReservationStatusTool(
  reader: ViewReservationReader = createProductionViewReservationReader()
): AssistantToolDefinition<
  ChangeReservationStatusToolInput,
  ChangeReservationStatusToolResult
> {
  return Object.freeze({
    description:
      "Propone cambiar el estado de una reserva a cancelada, completada o no presentación. Cancelar nunca modifica el estado de pago ni inicia un reembolso.",
    lane: "write",
    async handler(input, context): Promise<ChangeReservationStatusToolResult> {
      let paymentInfo: readonly ReservationPaymentInfo[] | undefined;
      if (input.to === "cancelled") {
        try {
          const detail = await reader.get(input.reservationId);
          if (detail) {
            paymentInfo = Object.freeze(
              detail.payments.map((payment) =>
                Object.freeze({ amountClp: payment.amountClp, status: payment.status })
              )
            );
          }
        } catch {
          // Payment info is informational; an unavailable reader (e.g. mock
          // context) must not block the proposal itself.
        }
      }

      const receipt = await proposeAssistantOperation({
        actorUserId: context.actorUserId,
        operation: "cambiar_estado",
        payload: { reservationId: input.reservationId, to: input.to },
      });
      return Object.freeze({ ...receipt, paymentInfo, success: true as const });
    },
    name: "cambiar_estado",
    schema,
  });
}
