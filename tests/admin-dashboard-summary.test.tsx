import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AdminDashboardView } from "@/features/admin/admin-dashboard-view";
import {
  createAdminDashboardSource,
  resolveAdminDashboardPeriod,
  selectRecentAdminReservations,
  yearRange,
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
    const summary = await source?.getSummary({ month: "2026-10", year: 2026 });

    expect(summary).toMatchObject({
      cancelledReservationCount: 1,
      kpis: {
        approvedRevenueClp: 12_500,
        occupancyPercentage: 5,
        openAlerts: 1,
        validReservationCount: 2,
      },
      noShowReservationCount: 1,
      period: { month: "2026-10", year: 2026 },
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
    expect(summary?.period.month).toMatch(/^\d{4}-\d{2}$/);
    expect(summary?.period.year).toBe(
      Number(summary?.period.month?.slice(0, 4))
    );
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

  it("aggregates a full-year mock ledger across every month when scoped to a year", async () => {
    const yearLedger: readonly MockDashboardReservation[] = [
      ...ledger,
      {
        checkIn: "2026-01-10",
        checkOut: "2026-01-12",
        id: "january",
        origin: "booking",
        payments: [{ amountClp: 20_000, status: "approved" }],
        roomId: "valle",
        status: "confirmed",
      },
      {
        checkIn: "2026-12-20",
        checkOut: "2026-12-22",
        id: "december",
        origin: "airbnb",
        payments: [{ amountClp: 30_000, status: "approved" }],
        roomId: "andes",
        status: "confirmed",
      },
    ];
    const source = createAdminDashboardSource("mock", {
      listAlerts: async () => [],
      listMonthlyLedger: () => yearLedger,
      listRecentReservations: () => [],
      listRooms: () => rooms,
    });
    const summary = await source?.getSummary({ month: null, year: 2026 });

    expect(summary).toMatchObject({
      kpis: { approvedRevenueClp: 12_500 + 20_000 + 30_000, validReservationCount: 4 },
      period: { month: null, year: 2026 },
    });
    const booking = summary?.channelBreakdown.find(
      (channel) => channel.origin === "booking"
    );
    expect(booking).toMatchObject({ approvedAmountClp: 20_000, reservationCount: 1 });
    const airbnb = summary?.channelBreakdown.find(
      (channel) => channel.origin === "airbnb"
    );
    // Includes the base ledger's already-confirmed "confirmed-unpaid" airbnb
    // reservation (0 approved) plus the new December one (30_000 approved).
    expect(airbnb).toMatchObject({ approvedAmountClp: 30_000, reservationCount: 2 });
    expect(summary?.dailySales).toHaveLength(365);
    expect(
      summary?.dailySales.find((day) => day.day === "2026-01-10")
    ).toMatchObject({ amountClp: 20_000 });
    expect(
      summary?.dailySales.find((day) => day.day === "2026-12-20")
    ).toMatchObject({ amountClp: 30_000 });
  });
});

describe("resolveAdminDashboardPeriod", () => {
  it("defaults to the current calendar month when neither year nor month is given", () => {
    const period = resolveAdminDashboardPeriod();
    expect(period.month).toMatch(/^\d{4}-\d{2}$/);
    expect(period.year).toBe(Number(period.month?.slice(0, 4)));
  });

  it("resolves a specific month, deriving its own year", () => {
    expect(resolveAdminDashboardPeriod({ month: "2025-03" })).toEqual({
      month: "2025-03",
      year: 2025,
    });
  });

  it("resolves a whole year when only year is given", () => {
    expect(resolveAdminDashboardPeriod({ year: "2025" })).toEqual({
      month: null,
      year: 2025,
    });
  });

  it("prefers a valid month over an inconsistent year", () => {
    expect(
      resolveAdminDashboardPeriod({ month: "2025-03", year: "2020" })
    ).toEqual({ month: "2025-03", year: 2025 });
  });
});

describe("yearRange", () => {
  it("spans the full calendar year inclusive", () => {
    expect(yearRange(2025)).toEqual({ from: "2025-01-01", to: "2025-12-31" });
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
  noShowReservationCount: 0,
  period: { month: "2026-10", year: 2026 },
  recentReservations: [],
  roomOccupancy: [],
};

const yearSummary: AdminDashboardSummary = {
  ...emptySummary,
  period: { month: null, year: 2026 },
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

const initialPeriod = { month: "2026-10", year: 2026 } as const;

describe("admin dashboard view", () => {
  it("shows a channel's amount and reservation count together, and keeps a room with no occupancy visible", () => {
    render(
      <AdminDashboardView
        initialPeriod={initialPeriod}
        initialSummary={filledSummary}
      />
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

  it("requests the newly selected year and shows shimmer while it loads", async () => {
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    render(
      <AdminDashboardView
        initialPeriod={initialPeriod}
        initialSummary={emptySummary}
      />
    );
    await act(async () => {
      screen.getAllByLabelText("Año siguiente")[0]?.click();
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/dashboard?year=2027",
      expect.anything()
    );
    expect(window.location.search).toBe("?year=2027");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Cargando resumen operativo"
    );
    await act(async () => {
      resolveFetch(new Response(JSON.stringify(yearSummary), { status: 200 }));
    });
    expect(screen.getAllByRole("combobox")[0]).toHaveValue("");
    vi.unstubAllGlobals();
  });

  it("switches between a month and 'Año completo' from the month select, and resets to 'Año completo' on year change", async () => {
    const fetchMock = vi.fn(async () =>
      Promise.resolve(new Response(JSON.stringify(yearSummary), { status: 200 }))
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(
      <AdminDashboardView
        initialPeriod={initialPeriod}
        initialSummary={emptySummary}
      />
    );

    await user.selectOptions(screen.getAllByRole("combobox")[0]!, "");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/dashboard?year=2026",
      expect.anything()
    );
    expect(window.location.search).toBe("?year=2026");

    await user.selectOptions(screen.getAllByRole("combobox")[0]!, "2026-03");
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/dashboard?year=2026&month=2026-03",
      expect.anything()
    );
    expect(window.location.search).toBe("?year=2026&month=2026-03");

    await act(async () => {
      screen.getAllByLabelText("Año anterior")[0]?.click();
    });
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/api/admin/dashboard?year=2025",
      expect.anything()
    );
    expect(window.location.search).toBe("?year=2025");
    expect(screen.getAllByRole("combobox")[0]).toHaveValue("");

    vi.unstubAllGlobals();
  });

  it("explains unavailable and empty summary states", () => {
    const { unmount } = render(
      <AdminDashboardView initialPeriod={initialPeriod} initialSummary={null} />
    );
    expect(screen.getByRole("status")).toHaveTextContent("no está disponible");
    unmount();
    render(
      <AdminDashboardView
        initialPeriod={initialPeriod}
        initialSummary={emptySummary}
      />
    );
    expect(screen.getAllByRole("status")[0]).toHaveTextContent(
      "No hay ventas registradas en el mes."
    );
    expect(screen.getByRole("link", { name: /Ver todas/ })).toHaveAttribute(
      "href",
      "/admin/reservas"
    );
  });

  it("labels KPIs and the sales chart for the year when no month is selected", () => {
    render(
      <AdminDashboardView
        initialPeriod={{ month: null, year: 2026 }}
        initialSummary={yearSummary}
      />
    );
    expect(screen.getAllByText("Reservas del año")[0]).toBeInTheDocument();
    expect(screen.getAllByText("Ventas del año")[0]).toBeInTheDocument();
    expect(screen.getAllByRole("status")[0]).toHaveTextContent(
      "No hay ventas registradas en el año."
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
      <AdminDashboardView
        initialPeriod={initialPeriod}
        initialSummary={emptySummary}
      />
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
