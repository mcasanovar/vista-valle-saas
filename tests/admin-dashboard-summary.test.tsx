import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminDashboardView } from "@/features/admin/admin-dashboard-view";
import {
  createAdminDashboardSource,
  selectRecentAdminReservations,
  type AdminDashboardSummary,
} from "@/features/admin/dashboard";
import type { OperationalAlert } from "@/features/admin/operational-alerts";
import type { AdminReservation } from "@/features/admin/reservations";

const reservations: readonly AdminReservation[] = [
  {
    audit: [],
    checkIn: "2026-10-05",
    checkOut: "2026-10-08",
    createdAt: new Date("2026-10-01T00:00:00.000Z"),
    guestEmail: "one@example.test",
    guestName: "Uno",
    guestPhone: "1",
    id: "one",
    origin: "website",
    room: "Valle",
    roomId: "valle",
    paymentStatus: "pending",
    status: "confirmed",
    totalClp: 12500,
  },
  {
    audit: [],
    checkIn: "2026-12-05",
    checkOut: "2026-12-08",
    createdAt: new Date("2026-11-01T00:00:00.000Z"),
    guestEmail: "two@example.test",
    guestName: "Dos",
    guestPhone: "2",
    id: "two",
    origin: "website",
    room: "Andes",
    roomId: "andes",
    paymentStatus: "approved",
    status: "cancelled",
    totalClp: 8000,
  },
] as const;

const alerts: readonly OperationalAlert[] = [
  { id: "alert-1", kind: "notification_failure", label: "Fallo" },
] as const;

describe("admin dashboard aggregate", () => {
  it("calculates mock KPIs from trusted reservation, payment and alert sources", async () => {
    const source = createAdminDashboardSource("mock", {
      listAlerts: async () => alerts,
      listReservations: () => reservations,
    });
    await expect(source?.getSummary()).resolves.toMatchObject({
      kpis: {
        activeReservations: 1,
        occupancyPercentage: 50,
        openAlerts: 1,
        pendingPaymentsClp: 12500,
      },
    });
  });

  it("orders recent rows by the available trusted date and applies the requested limit", () => {
    expect(
      selectRecentAdminReservations(reservations, 1).map((row) => row.id)
    ).toEqual(["two"]);
    expect(selectRecentAdminReservations(reservations, 0)).toEqual([]);
  });

  it("fails closed in production", () => {
    expect(createAdminDashboardSource("production")).toBeNull();
  });
});

const emptySummary: AdminDashboardSummary = {
  kpis: {
    activeReservations: 0,
    occupancyPercentage: 0,
    openAlerts: 0,
    pendingPaymentsClp: 0,
  },
  recentReservations: [],
};

describe("admin dashboard view", () => {
  it("explains unavailable and empty summary states", () => {
    const { unmount } = render(<AdminDashboardView initialSummary={null} />);
    expect(screen.getByRole("status")).toHaveTextContent("no está disponible");
    unmount();
    render(<AdminDashboardView initialSummary={emptySummary} />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "No hay reservas recientes"
    );
    expect(screen.getByRole("link", { name: /Ver todas/ })).toHaveAttribute(
      "href",
      "/admin/reservas"
    );
  });

  it("keeps refresh text visible while skeletons replace prior data", async () => {
    let resolveFetch!: (value: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      )
    );
    render(<AdminDashboardView initialSummary={emptySummary} />);
    await act(async () => {
      screen.getAllByRole("button", { name: "Actualizar datos" })[0]?.click();
    });
    expect(
      screen
        .getAllByRole("button", { name: "Actualizando…" })
        .every((button) => button.hasAttribute("disabled"))
    ).toBe(true);
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando resumen operativo"
    );
    await act(async () => {
      resolveFetch(new Response(JSON.stringify(emptySummary), { status: 200 }));
    });
    vi.unstubAllGlobals();
  });
});
