import "server-only";

import { z } from "zod";

import type { AssistantToolDefinition } from "../../tool-registry";
import { proposeAssistantOperation } from "../../propose";

const schema = z.object({
  checkIn: z.string(),
  checkOut: z.string(),
  reservationId: z.string().min(1),
});

export type EditReservationDatesToolInput = z.infer<typeof schema>;

export type EditReservationDatesToolResult = Readonly<{
  expiresAt: string;
  success: true;
  token: string;
}>;

/**
 * `editar_fechas` (task 6.5): proposes new dates for a reservation. The
 * real conflict check (whether the new interval is free) happens only at
 * confirmation, inside `editReservationDates` itself — proposing here
 * never touches data.
 */
export function createEditReservationDatesTool(): AssistantToolDefinition<
  EditReservationDatesToolInput,
  EditReservationDatesToolResult
> {
  return Object.freeze({
    description:
      "Propone editar las fechas de una reserva existente. No las cambia: genera una propuesta que el administrador debe confirmar.",
    lane: "write",
    async handler(input, context): Promise<EditReservationDatesToolResult> {
      const receipt = await proposeAssistantOperation({
        actorUserId: context.actorUserId,
        operation: "editar_fechas",
        payload: input,
      });
      return Object.freeze({ ...receipt, success: true as const });
    },
    name: "editar_fechas",
    schema,
  });
}
