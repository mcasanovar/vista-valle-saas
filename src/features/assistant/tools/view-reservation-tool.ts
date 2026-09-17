import "server-only";

import { z } from "zod";

import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import {
  getAdminReservationDetail,
  type AdminReservationDetail,
} from "@/infrastructure/database/admin-reservation-source";

import type { AssistantToolDefinition } from "../tool-registry";
import { ReservationReadsUnavailableError } from "./list-reservations-tool";

const schema = z.object({
  reservationId: z.string(),
});

export type ViewReservationToolInput = z.infer<typeof schema>;

export type ViewReservationReader = Readonly<{
  get: (reservationId: string) => Promise<AdminReservationDetail | null>;
}>;

export function createProductionViewReservationReader(): ViewReservationReader {
  return Object.freeze({
    async get(reservationId) {
      const boundary = createDatabaseBoundary();
      if (boundary.context !== "production") {
        throw new ReservationReadsUnavailableError();
      }
      return getAdminReservationDetail(
        createProductionDatabase(boundary),
        reservationId
      );
    },
  });
}

export type ViewReservationToolResult =
  | Readonly<{ found: true; reservation: AdminReservationDetail; success: true }>
  | Readonly<{ found: false; success: true }>
  | Readonly<{ code: "unavailable"; message: string; success: false }>;

/**
 * `ver_reserva` (task 5.3): the detail already includes payment status
 * (`payments`) and the full status-change history (`auditEvents`) —
 * nothing extra to assemble here.
 */
export function createViewReservationTool(
  reader: ViewReservationReader = createProductionViewReservationReader()
): AssistantToolDefinition<ViewReservationToolInput, ViewReservationToolResult> {
  return Object.freeze({
    description:
      "Muestra el detalle de una reserva por id, incluido su estado de pago y su historial de cambios de estado.",
    async handler(input): Promise<ViewReservationToolResult> {
      try {
        const reservation = await reader.get(input.reservationId);
        if (!reservation) return Object.freeze({ found: false as const, success: true as const });
        return Object.freeze({
          found: true as const,
          reservation,
          success: true as const,
        });
      } catch (error) {
        if (error instanceof ReservationReadsUnavailableError) {
          return Object.freeze({
            code: "unavailable" as const,
            message: error.message,
            success: false as const,
          });
        }
        throw error;
      }
    },
    lane: "read",
    name: "ver_reserva",
    schema,
  });
}
