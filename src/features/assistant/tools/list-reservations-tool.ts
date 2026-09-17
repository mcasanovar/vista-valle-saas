import "server-only";

import { z } from "zod";

import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import {
  listAdminReservations,
  type AdminReservationListFilter,
  type AdminReservationListResult,
} from "@/infrastructure/database/admin-reservation-source";

import type { AssistantToolDefinition } from "../tool-registry";

const schema = z.object({
  checkInFrom: z.string().optional(),
  checkInTo: z.string().optional(),
  checkOutFrom: z.string().optional(),
  checkOutTo: z.string().optional(),
  origin: z
    .enum(["website", "airbnb", "booking", "phone", "whatsapp", "admin"])
    .optional(),
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(50).default(20),
  /** Free text — already covers guest name, email, phone, RUT, company, public id and room name (proposal.md). */
  search: z.string().optional(),
  status: z
    .enum(["confirmed", "cancelled", "completed", "no_show"])
    .optional(),
});

export type ListReservationsToolInput = z.infer<typeof schema>;

export type ListReservationsReader = Readonly<{
  list: (filter: AdminReservationListFilter) => Promise<AdminReservationListResult>;
}>;

export class ReservationReadsUnavailableError extends Error {
  constructor() {
    super("Reservation reads are only available in production");
    this.name = "ReservationReadsUnavailableError";
  }
}

export function createProductionListReservationsReader(): ListReservationsReader {
  return Object.freeze({
    async list(filter) {
      const boundary = createDatabaseBoundary();
      if (boundary.context !== "production") {
        throw new ReservationReadsUnavailableError();
      }
      return listAdminReservations(createProductionDatabase(boundary), filter);
    },
  });
}

export type ListReservationsToolResult =
  | Readonly<{
      page: number;
      pageSize: number;
      rows: AdminReservationListResult["rows"];
      success: true;
      total: number;
    }>
  | Readonly<{ code: "unavailable"; message: string; success: false }>;

/** `listar_reservas` (task 5.2): a thin adapter over `listAdminReservations` — the free-text `search` field already covers name/email/phone/RUT/company/public id/room name. */
export function createListReservationsTool(
  reader: ListReservationsReader = createProductionListReservationsReader()
): AssistantToolDefinition<ListReservationsToolInput, ListReservationsToolResult> {
  return Object.freeze({
    description:
      "Lista y filtra reservas por estado, origen, rango de entrada/salida y búsqueda libre (nombre, correo, teléfono, RUT, empresa, identificador público o habitación).",
    async handler(input): Promise<ListReservationsToolResult> {
      const filter: AdminReservationListFilter = {
        checkIn:
          input.checkInFrom || input.checkInTo
            ? { from: input.checkInFrom, to: input.checkInTo }
            : undefined,
        checkOut:
          input.checkOutFrom || input.checkOutTo
            ? { from: input.checkOutFrom, to: input.checkOutTo }
            : undefined,
        origin: input.origin,
        page: input.page,
        pageSize: input.pageSize,
        search: input.search,
        status: input.status,
      };
      try {
        const result = await reader.list(filter);
        return Object.freeze({ ...result, success: true as const });
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
    name: "listar_reservas",
    schema,
  });
}
