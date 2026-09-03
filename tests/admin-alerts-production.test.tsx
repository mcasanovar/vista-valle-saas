import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listOperationalAlerts: vi.fn(),
  queryPendingPayAtPropertyPayments: vi.fn(),
  getReservationSummaryById: vi.fn(),
}));

vi.mock("@/infrastructure/database/server", () => ({
  createDatabaseBoundary: () => ({
    context: "production",
    connectionString: "postgres://test",
  }),
}));
vi.mock("@/infrastructure/database/client", () => ({
  createProductionDatabase: () => ({}),
}));
vi.mock("@/infrastructure/database/operational-alerts-source", () => ({
  listOperationalAlerts: mocks.listOperationalAlerts,
  recordOperationalAlert: vi.fn(),
}));
vi.mock("@/infrastructure/database/admin-pending-payments-source", () => ({
  queryPendingPayAtPropertyPayments: mocks.queryPendingPayAtPropertyPayments,
}));
vi.mock("@/infrastructure/database/reservation-summary-source", () => ({
  getReservationSummaryById: mocks.getReservationSummaryById,
}));

import AlertsPage from "../app/(admin-protected)/admin/alertas/page";

describe("admin alerts under production context", () => {
  it("shows real channel-sync conflicts and pending payments, no mock demo item", async () => {
    mocks.listOperationalAlerts.mockResolvedValue([
      {
        id: "alert-conflict-1",
        kind: "channel_sync_conflict",
        roomId: "room-1",
        reservationId: "reservation-existing",
        message:
          "He encontrado una reserva sobreduplicada para web y airbnb/booking. Revise la reserva para coordinar con huésped.",
        createdAt: new Date("2026-01-01T00:00:00Z"),
      },
    ]);
    mocks.queryPendingPayAtPropertyPayments.mockResolvedValue([
      {
        id: "reservation-pending-payment",
        checkIn: "2026-02-01",
        checkOut: "2026-02-03",
        guestName: "Ana Pérez",
        roomId: "room-2",
        roomIds: ["room-2"],
        origin: "website",
        status: "confirmed",
        totalClp: 90_000,
        paymentStatus: "pending",
      },
    ]);
    mocks.getReservationSummaryById.mockResolvedValue({
      guestName: "Carlos Soto",
      origin: "airbnb",
      totalClp: 150_000,
    });

    render(await AlertsPage());

    expect(
      screen.getByText(/reserva sobreduplicada para web y airbnb\/booking/)
    ).toBeInTheDocument();
    expect(screen.getByText("Pago al llegar pendiente")).toBeInTheDocument();
    expect(screen.getByText("Ana Pérez")).toBeInTheDocument();
    expect(screen.getByText("$90.000")).toBeInTheDocument();
    expect(screen.getByText("Sitio web")).toBeInTheDocument();
    expect(screen.getByText("Carlos Soto")).toBeInTheDocument();
    expect(screen.getByText("$150.000")).toBeInTheDocument();
    expect(screen.getByText("Airbnb")).toBeInTheDocument();
    expect(mocks.getReservationSummaryById).toHaveBeenCalledWith(
      {},
      "reservation-existing"
    );
    expect(
      screen.queryByText("Notificación pendiente de revisión")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("El seguimiento no está disponible.")
    ).not.toBeInTheDocument();
  });
});
