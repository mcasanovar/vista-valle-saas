import { describe, expect, it } from "vitest";

import type { AssistantToolInvocationContext } from "@/features/assistant/tool-registry";
import { createSearchAvailabilityTool } from "@/features/assistant/tools/search-availability-tool";
import {
  createListReservationsTool,
  ReservationReadsUnavailableError,
  type ListReservationsReader,
} from "@/features/assistant/tools/list-reservations-tool";
import {
  createViewReservationTool,
  type ViewReservationReader,
} from "@/features/assistant/tools/view-reservation-tool";
import { createListRoomBlocksTool } from "@/features/assistant/tools/list-room-blocks-tool";
import { createFinancialSummaryTool } from "@/features/assistant/tools/financial-summary-tool";
import { getAdminDashboardSummary, resolveAdminDashboardPeriod } from "@/features/admin";
import type { AdminReservationDetail } from "@/infrastructure/database/admin-reservation-source";

const context: AssistantToolInvocationContext = Object.freeze({
  actorUserId: "admin-1",
  operationalContext: Object.freeze({
    rooms: [],
    today: "2030-01-01",
    validManualOrigins: [],
    validReservationStatusTransitions: [],
    validRoomBlockStatuses: [],
  }),
});

describe("buscar_disponibilidad tool", () => {
  it("reports a nonexistent room as a typed failure, never a fabricated match", async () => {
    const tool = createSearchAvailabilityTool();

    const result = await tool.handler(
      {
        checkIn: "2031-01-01",
        checkOut: "2031-01-03",
        room: "does-not-exist-room",
      },
      context
    );

    expect(result).toMatchObject({ success: false, code: "invalid_input" });
  });

  it("reports a bad date range as a typed failure instead of throwing", async () => {
    const tool = createSearchAvailabilityTool();

    const result = await tool.handler(
      { checkIn: "not-a-date", checkOut: "2031-01-03" },
      context
    );

    expect(result).toMatchObject({ success: false, code: "invalid_input" });
  });
});

describe("listar_reservas tool", () => {
  it("forwards free-text search (name/email/phone) to the reader and returns the guest's reservations", async () => {
    const seen: unknown[] = [];
    const reader: ListReservationsReader = {
      async list(filter) {
        seen.push(filter);
        return {
          page: filter.page,
          pageSize: filter.pageSize ?? 20,
          rows: [
            {
              checkIn: "2030-02-01",
              checkOut: "2030-02-03",
              createdAt: new Date("2030-01-01T00:00:00Z"),
              guestName: "Ana Pérez",
              id: "reservation-1",
              invoiceRequested: false,
              origin: "website",
              paymentStatus: "paid",
              publicId: "VV-1",
              rooms: ["Andes"],
              status: "confirmed",
              totalClp: 100_000,
            },
          ],
          total: 1,
        };
      },
    };
    const tool = createListReservationsTool(reader);

    const result = await tool.handler({ page: 1, pageSize: 20, search: "ana@example.com" }, context);

    expect(seen).toEqual([
      expect.objectContaining({ search: "ana@example.com" }),
    ]);
    expect(result).toMatchObject({
      success: true,
      total: 1,
      rows: [expect.objectContaining({ guestName: "Ana Pérez" })],
    });
  });

  it("communicates zero matches as an empty list, never fabricated rows", async () => {
    const reader: ListReservationsReader = {
      async list(filter) {
        return { page: filter.page, pageSize: filter.pageSize ?? 20, rows: [], total: 0 };
      },
    };
    const tool = createListReservationsTool(reader);

    const result = await tool.handler({ page: 1, pageSize: 20, search: "nadie-existe" }, context);

    expect(result).toEqual({ success: true, page: 1, pageSize: 20, rows: [], total: 0 });
  });

  it("reports unavailable reads (mock context) as a typed failure", async () => {
    const reader: ListReservationsReader = {
      async list() {
        throw new ReservationReadsUnavailableError();
      },
    };
    const tool = createListReservationsTool(reader);

    const result = await tool.handler({ page: 1, pageSize: 20 }, context);

    expect(result).toMatchObject({ success: false, code: "unavailable" });
  });
});

describe("ver_reserva tool", () => {
  it("reports a nonexistent reservation id as found: false, not an error", async () => {
    const reader: ViewReservationReader = { async get() { return null; } };
    const tool = createViewReservationTool(reader);

    const result = await tool.handler({ reservationId: "does-not-exist" }, context);

    expect(result).toEqual({ success: true, found: false });
  });

  it("returns the full detail including payment status and history when found", async () => {
    const detail: AdminReservationDetail = {
      auditEvents: [
        {
          action: "reservation.transitioned",
          actorUserId: "admin-1",
          after: { status: "cancelled" },
          before: { status: "confirmed" },
          occurredAt: new Date("2030-01-02T00:00:00Z"),
        },
      ],
      channelSyncTasks: [],
      checkIn: "2030-02-01",
      checkOut: "2030-02-03",
      createdAt: new Date("2030-01-01T00:00:00Z"),
      externalPlatform: null,
      guest: {
        company: null,
        email: "ana@example.com",
        firstName: "Ana",
        lastName: "Pérez",
        phone: "+56911111111",
        rut: null,
      },
      guestComment: null,
      id: "reservation-1",
      items: [],
      origin: "website",
      payments: [
        {
          amountClp: 100_000,
          createdAt: new Date("2030-01-01T00:00:00Z"),
          id: "payment-1",
          paymentMethod: null,
          providerPaymentId: null,
          provider: "fintoc",
          receivedAt: null,
          refundedAmountClp: 0,
          status: "approved",
        },
      ],
      publicId: "VV-1",
      status: "cancelled",
      totalClp: 100_000,
    };
    const reader: ViewReservationReader = { async get() { return detail; } };
    const tool = createViewReservationTool(reader);

    const result = await tool.handler({ reservationId: "reservation-1" }, context);

    expect(result).toMatchObject({
      success: true,
      found: true,
      reservation: { auditEvents: expect.any(Array), payments: expect.any(Array) },
    });
    if (result.success && result.found) {
      expect(result.reservation.auditEvents).toHaveLength(1);
      expect(result.reservation.payments[0]).toMatchObject({ status: "approved" });
    }
  });
});

describe("resumen_financiero tool", () => {
  it("returns the same approved-revenue figure the dashboard computes, never recalculated here", async () => {
    const tool = createFinancialSummaryTool();
    const period = resolveAdminDashboardPeriod({ year: "2030", month: "2030-01" });

    const [toolResult, directSummary] = await Promise.all([
      tool.handler({ month: "2030-01", year: "2030" }, context),
      getAdminDashboardSummary(period),
    ]);

    expect(toolResult).toMatchObject({ success: true });
    if (toolResult.success) {
      expect(toolResult.summary.kpis.approvedRevenueClp).toBe(
        directSummary!.kpis.approvedRevenueClp
      );
    }
  });
});

describe("listar_bloqueos tool", () => {
  it("respects the status filter and returns an empty page when there are no active blocks", async () => {
    const tool = createListRoomBlocksTool();

    const result = await tool.handler({ page: 1, pageSize: 20, status: "active" }, context);

    expect(result).toMatchObject({ success: true, items: [], total: 0 });
  });
});
