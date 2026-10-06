import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ detail: vi.fn(), list: vi.fn() }));

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator: vi.fn().mockResolvedValue({ user: { id: "admin-1" } }),
}));
vi.mock("@/infrastructure/database/server", () => ({
  createDatabaseBoundary: () => ({ context: "production" }),
}));
vi.mock("@/infrastructure/database/client", () => ({
  createProductionDatabase: () => ({}),
}));
vi.mock("@/infrastructure/database/admin-company-quotation-source", () => ({
  getAdminCompanyQuotationDetail: mocks.detail,
  listAdminCompanyQuotations: mocks.list,
}));

import CompanyQuotationDetail from "../app/(admin-protected)/admin/cotizaciones/[id]/page";
import CompanyQuotationsPage from "../app/(admin-protected)/admin/cotizaciones/page";

const listRow = {
  breakfastRequested: false,
  checkIn: "2033-03-10",
  checkOut: "2033-03-12",
  company: "Empresa Render SpA",
  contact: "Ana Render",
  createdAt: new Date("2033-01-05T12:30:00.000Z"),
  deliveryState: "failed" as const,
  email: "render@example.test",
  guestCount: 3,
  id: "quotation-1",
  nights: 2,
  rooms: ["1 × Habitación Individual", "1 × Habitación Doble"],
  totalClp: 375_000,
};

const detail = {
  breakfastQuantity: 3,
  breakfastRequested: true,
  breakfastSubtotalClp: 48_000,
  breakfastUnitPriceClp: 8_000,
  capacity: 4,
  checkIn: "2033-03-10",
  checkOut: "2033-03-12",
  company: "Empresa Render SpA",
  contact: "Ana Render",
  createdAt: new Date("2033-01-05T12:30:00.000Z"),
  deliveryState: "delivered" as const,
  email: "render@example.test",
  guestCount: 3,
  id: "quotation-1",
  lines: [
    {
      capacity: 1,
      guestCount: 1,
      nightlyPriceClp: 55_000,
      nights: 2,
      quantity: 1,
      roomName: "Habitación Individual",
      roomSlug: "habitacion-valle-demo",
      subtotalClp: 110_000,
    },
    {
      capacity: 2,
      guestCount: 2,
      nightlyPriceClp: 70_000,
      nights: 2,
      quantity: 1,
      roomName: "Habitación Doble",
      roomSlug: "habitacion-terra-demo",
      subtotalClp: 140_000,
    },
  ],
  message: "Necesitamos facturación a 30 días.",
  nights: 2,
  notifications: [
    {
      attempts: 1,
      createdAt: new Date("2033-01-05T12:30:05.000Z"),
      deliveredAt: new Date("2033-01-05T12:30:09.000Z"),
      lastErrorCode: null,
      status: "delivered" as const,
      type: "company_quotation_customer",
    },
    {
      attempts: 2,
      createdAt: new Date("2033-01-05T12:30:06.000Z"),
      deliveredAt: null,
      lastErrorCode: "delivery_transient",
      status: "retrying" as const,
      type: "company_quotation_admin",
    },
  ],
  phone: "+56900000000",
  requireParking: true,
  totalClp: 298_000,
};

describe("admin company quotations listing rendering", () => {
  it("renders one row per quotation with its rooms, guests, delivery chip and total, linked to its detail", async () => {
    mocks.list.mockResolvedValueOnce({
      page: 1,
      pageSize: 20,
      rows: [listRow],
      total: 1,
    });

    render(await CompanyQuotationsPage({ searchParams: Promise.resolve({}) }));

    const row = screen.getByRole("link", { name: /Empresa Render SpA/ });
    expect(within(row).getByText("Ana Render")).toBeVisible();
    expect(
      within(row).getByText("1 × Habitación Individual, 1 × Habitación Doble")
    ).toBeVisible();
    expect(within(row).getByText("2033-03-10")).toBeVisible();
    expect(within(row).getByText("2033-03-12")).toBeVisible();
    expect(within(row).getByText("Falló")).toBeVisible();
    expect(within(row).getByText("$375.000")).toBeVisible();
    expect(screen.getByLabelText("Buscar y filtrar cotizaciones")).toBeVisible();
  });

  it("passes the URL filters through to the data layer", async () => {
    mocks.list.mockResolvedValueOnce({
      page: 2,
      pageSize: 20,
      rows: [],
      total: 0,
    });

    render(
      await CompanyQuotationsPage({
        searchParams: Promise.resolve({
          checkInFrom: "2033-03-01",
          checkInTo: "2033-03-31",
          deliveryState: "failed",
          page: "2",
          search: "Render",
        }),
      })
    );

    expect(mocks.list).toHaveBeenCalledWith(expect.anything(), {
      checkIn: { from: "2033-03-01", to: "2033-03-31" },
      checkOut: undefined,
      deliveryState: "failed",
      page: 2,
      search: "Render",
    });
    expect(
      screen.getByText("No se encontraron cotizaciones para estos filtros.")
    ).toBeVisible();
  });

  it("ignores an unknown delivery-state filter instead of passing it through", async () => {
    mocks.list.mockResolvedValueOnce({
      page: 1,
      pageSize: 20,
      rows: [],
      total: 0,
    });

    render(
      await CompanyQuotationsPage({
        searchParams: Promise.resolve({ deliveryState: "whatever" }),
      })
    );

    expect(mocks.list).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ deliveryState: undefined })
    );
  });
});

describe("admin company quotation detail rendering", () => {
  it("renders company, stay, room lines, breakfast, total, message and per-notification delivery state", async () => {
    mocks.detail.mockResolvedValueOnce(detail);

    render(
      await CompanyQuotationDetail({
        params: Promise.resolve({ id: "quotation-1" }),
      })
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Empresa Render SpA" })
    ).toBeVisible();
    expect(screen.getByText("Ana Render")).toBeVisible();
    expect(screen.getByText("render@example.test")).toBeVisible();
    expect(screen.getByText("+56900000000")).toBeVisible();
    expect(screen.getByText("Sí")).toBeVisible();

    expect(screen.getByText("3 de 4 de capacidad")).toBeVisible();
    expect(screen.getByText("1 × Habitación Individual")).toBeVisible();
    expect(screen.getByText("1 × Habitación Doble")).toBeVisible();
    expect(screen.getByText("$110.000")).toBeVisible();

    const breakfast = screen.getByLabelText("Desayuno");
    expect(within(breakfast).getByText(/3 por noche/)).toBeVisible();
    expect(within(breakfast).getByText("$48.000")).toBeVisible();

    expect(screen.getByText("$298.000")).toBeVisible();
    expect(
      screen.getByText("Necesitamos facturación a 30 días.")
    ).toBeVisible();

    const notifications = screen.getByLabelText("Entrega de correos");
    expect(
      within(notifications).getByText("Cotización al cliente")
    ).toBeVisible();
    expect(
      within(notifications).getByText("Aviso a administración")
    ).toBeVisible();
    expect(
      within(notifications).getByText(/Reintentando · 2 intentos/)
    ).toBeVisible();
    expect(
      within(notifications).getByText(/delivery_transient/)
    ).toBeVisible();
  });

  it("omits the breakfast and message sections when they do not apply", async () => {
    mocks.detail.mockResolvedValueOnce({
      ...detail,
      breakfastQuantity: null,
      breakfastRequested: false,
      breakfastSubtotalClp: 0,
      breakfastUnitPriceClp: null,
      lines: [detail.lines[0]!],
      message: null,
      notifications: [],
    });

    render(
      await CompanyQuotationDetail({
        params: Promise.resolve({ id: "quotation-1" }),
      })
    );

    expect(screen.queryByLabelText("Desayuno")).toBeNull();
    expect(
      screen.queryByText("Necesitamos facturación a 30 días.")
    ).toBeNull();
    expect(
      screen.getByText("Esta cotización no tiene correos registrados.")
    ).toBeVisible();
  });

  it("renders the not-found page for an unknown quotation id", async () => {
    mocks.detail.mockResolvedValueOnce(null);

    await expect(
      CompanyQuotationDetail({ params: Promise.resolve({ id: "missing" }) })
    ).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
