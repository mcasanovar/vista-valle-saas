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

/**
 * What actually reaches the model (harden-admin-authentication, task
 * 12.1): `AdminReservationDetail` minus the guest's contact and billing
 * data and their free-text comment — name, dates, status, amounts and
 * identifiers are enough for the assistant's operations, and none of them
 * need `email`, `phone`, `rut`, `company`, `invoiceRequest` or
 * `guestComment` to work. An administrator who needs a contact detail gets
 * it from the admin UI directly, not through the model (see
 * `admin-password-auth/spec.md`, "Minimización de datos personales
 * enviados al proveedor de modelo").
 */
export type AssistantSafeReservationDetail = Omit<
  AdminReservationDetail,
  "guest" | "guestComment" | "invoiceRequest"
> &
  Readonly<{
    guest: Readonly<{ firstName: string; lastName: string }>;
  }>;

function toAssistantSafeReservationDetail(
  reservation: AdminReservationDetail
): AssistantSafeReservationDetail {
  const { guest, guestComment: _guestComment, invoiceRequest: _invoiceRequest, ...rest } =
    reservation;
  return Object.freeze({
    ...rest,
    guest: Object.freeze({
      firstName: guest.firstName,
      lastName: guest.lastName,
    }),
  });
}

export type ViewReservationToolResult =
  | Readonly<{
      found: true;
      reservation: AssistantSafeReservationDetail;
      success: true;
    }>
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
          reservation: toAssistantSafeReservationDetail(reservation),
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
