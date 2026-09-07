import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AdminDashboardView } from "@/features/admin/admin-dashboard-view";
import {
  createAdminDashboardSource,
  selectRecentAdminReservations,
  type AdminDashboardSummary,
  type MockDashboardReservation,
  type MockDashboardRoom,
} from "@/features/admin/dashboard";
import type { OperationalAlert } from "@/features/admin/operational-alerts";
import type { AdminReservation } from "@/features/admin/reservations";

const recentReservations: readonly AdminReservation[] = [
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

const ledger: readonly MockDashboardReservation[] = [
  {
    checkIn: "2026-10-05",
    checkOut: "2026-10-08",
    id: "confirmed-paid",
    origin: "website",
    payments: [{ amountClp: 12_500, status: "approved" }],
    roomId: "valle",
    status: "confirmed",
  },
  {
    checkIn: "2026-10-10",
    checkOut: "2026-10-12",
    id: "confirmed-unpaid",
    origin: "airbnb",
    payments: [{ amountClp: 9_000, status: "pending" }],
    roomId: "andes",
    status: "confirmed",
  },
  {
    checkIn: "2026-10-15",
    checkOut: "2026-10-16",
    id: "cancelled",
    origin: "website",
    payments: [],
    roomId: "valle",
    status: "cancelled",
  },
  {
    checkIn: "2026-10-20",
    checkOut: "2026-10-21",
    id: "no-show",
    origin: "booking",
    payments: [],
    roomId: "valle",
    status: "no_show",
  },
];

const rooms: readonly MockDashboardRoom[] = [
  {
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: "valle",
    name: "Valle",
  },
  {
    active: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: "andes",
    name: "Andes",
  },
  {
    active: false,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    id: "cumbre",
    name: "Cumbre",
  },
];

describe("admin dashboard aggregate", () => {
  it("calculates mock KPIs and monthly breakdowns for the requested month", async () => {
    const source = createAdminDashboardSource("mock", {
      listAlerts: async () => alerts,
      listMonthlyLedger: () => ledger,
      listRecentReservations: () => recentReservations,
      listRooms: () => rooms,
    });
    const summary = await source?.getSummary("2026-10");

    expect(summary).toMatchObject({
      cancelledReservationCount: 1,
      kpis: {
        approvedRevenueClp: 12_500,
        occupancyPercentage: 5,
        openAlerts: 1,
        validReservationCount: 2,
      },
      month: "2026-10",
      noShowReservationCount: 1,
    });

    const website = summary?.channelBreakdown.find(
      (channel) => channel.origin === "website"
    );
    expect(website).toMatchObject({ approvedAmountClp: 12_500, reservationCount: 1 });
    const whatsapp = summary?.channelBreakdown.find(
      (channel) => channel.origin === "whatsapp"
    );
    expect(whatsapp).toMatchObject({ approvedAmountClp: 0, reservationCount: 0 });

    const valle = summary?.roomOccupancy.find((room) => room.roomId === "valle");
    expect(valle).toMatchObject({ availableNights: 31, occupiedNights: 3 });
    const andes = summary?.roomOccupancy.find((room) => room.roomId === "andes");
    expect(andes).toMatchObject({ availableNights: 31, occupiedNights: 0 });
    expect(
      summary?.roomOccupancy.some((room) => room.roomId === "cumbre")
    ).toBe(false);

    expect(summary?.dailySales).toHaveLength(31);
    expect(
      summary?.dailySales.find((day) => day.day === "2026-10-05")
    ).toMatchObject({ amountClp: 12_500 });
    expect(
      summary?.dailySales.find((day) => day.day === "2026-10-01")
    ).toMatchObject({ amountClp: 0 });
  });

  it("defaults to the current calendar month when none is requested", async () => {
    const source = createAdminDashboardSource("mock", {
      listAlerts: async () => [],
      listMonthlyLedger: () => [],
      listRecentReservations: () => [],
      listRooms: () => [],
    });
    const summary = await source?.getSummary();
    expect(summary?.month).toMatch(/^\d{4}-\d{2}$/);
  });

  it("orders recent rows by the available trusted date and applies the requested limit", () => {
    expect(
      selectRecentAdminReservations(recentReservations, 1).map((row) => row.id)
    ).toEqual(["two"]);
    expect(selectRecentAdminReservations(recentReservations, 0)).toEqual([]);
  });

  it("fails closed when no production database boundary is available", () => {
    expect(createAdminDashboardSource("production")).toBeNull();
  });
});

const emptySummary: AdminDashboardSummary = {
  cancelledReservationCount: 0,
  channelBreakdown: [],
  dailySales: [],
  kpis: {
    approvedRevenueClp: 0,
    validReservationCount: 0,
    occupancyPercentage: 0,
    openAlerts: 0,
  },
  month: "2026-10",
  noShowReservationCount: 0,
  recentReservations: [],
  roomOccupancy: [],
};

const currency = new Intl.NumberFormat("es-CL", {
  currency: "CLP",
  maximumFractionDigits: 0,
  style: "currency",
});

const filledSummary: AdminDashboardSummary = {
  ...emptySummary,
  channelBreakdown: [
    { approvedAmountClp: 45_000, origin: "website", reservationCount: 3 },
    { approvedAmountClp: 0, origin: "airbnb", reservationCount: 0 },
  ],
  dailySales: [
    { amountClp: 10_000, day: "2026-10-01", reservationCount: 2 },
    { amountClp: 0, day: "2026-10-02", reservationCount: 0 },
  ],
  roomOccupancy: [
    {
      availableNights: 31,
      occupancyPercentage: 0,
      occupiedNights: 0,
      roomId: "valle",
      roomName: "Valle",
    },
  ],
};

describe("admin dashboard view", () => {
  it("shows a channel's amount and reservation count together, and keeps a room with no occupancy visible", () => {
    render(
      <AdminDashboardView initialMonth="2026-10" initialSummary={filledSummary} />
    );
    expect(screen.getByText("Sitio web")).toBeInTheDocument();
    expect(screen.getByLabelText("3 reservas")).toBeInTheDocument();
    expect(
      screen.getByText(currency.format(45_000))
    ).toBeInTheDocument();
    expect(
      screen.getByText("Valle").closest("li")
    ).toHaveTextContent("0%");
  });

  it("requests the newly selected month and shows shimmer while it loads", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AdminDashboardView initialMonth="2026-10" initialSummary={emptySummary} />
    );
    await act(async () => {
      screen.getAllByLabelText("Mes siguiente")[0]?.click();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/dashboard?month=2026-11",
      expect.anything()
    );
    expect(window.location.search).toBe("?month=2026-11");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando resumen operativo"
    );
    await act(async () => {
      resolveFetch(new Response(JSON.stringify(emptySummary), { status: 200 }));
    });
    vi.unstubAllGlobals();
  });

  it("explains unavailable and empty summary states", () => {
    const { unmount } = render(
      <AdminDashboardView initialMonth="2026-10" initialSummary={null} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("no está disponible");
    unmount();
    render(
      <AdminDashboardView initialMonth="2026-10" initialSummary={emptySummary} />
    );
    expect(screen.getAllByRole("status")[0]).toHaveTextContent(
      "No hay ventas registradas en el mes."
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
    render(
      <AdminDashboardView initialMonth="2026-10" initialSummary={emptySummary} />
    );
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
