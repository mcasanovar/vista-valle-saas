import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({ detail: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn(), back: vi.fn() }),
}));
vi.mock("@/infrastructure/database/server", () => ({
  createDatabaseBoundary: () => ({ context: "production" }),
}));
vi.mock("@/infrastructure/database/client", () => ({
  createProductionDatabase: () => ({}),
}));
vi.mock("@/infrastructure/database/admin-reservation-source", () => ({
  getAdminReservationDetail: mocks.detail,
}));
vi.mock("@/features/admin/reservation-actions", () => ({
  transitionAdminReservation: vi.fn(),
}));
vi.mock("@/features/admin/reservation-transition-controls", () => ({
  ReservationTransitionControls: () => null,
}));
vi.mock("@/features/admin/pay-at-property-admin-collect-action", () => ({
  collectPayAtPropertyAdminAction: vi.fn(),
}));
vi.mock("@/features/admin/fintoc-refund-action", () => ({
  refundFintocPaymentAction: vi.fn(),
}));
vi.mock("@/features/admin/mark-payment-paid-action", () => ({
  markPaymentPaidAdminAction: vi.fn(),
}));
vi.mock("@/features/payments/pay-at-property-collection-form", () => ({
  PayAtPropertyCollectionForm: () => null,
}));
vi.mock("@/features/payments/fintoc-refund-form", () => ({
  FintocRefundForm: () => null,
}));
vi.mock("@/features/payments/mark-payment-paid-form", () => ({
  MarkPaymentPaidForm: () => null,
}));

import ReservationDetail from "../app/(admin-protected)/admin/reservas/[id]/page";

function baseDetail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "reservation-1",
    publicId: "VV-abc",
    status: "confirmed",
    origin: "airbnb",
    checkIn: "2026-11-01",
    checkOut: "2026-11-03",
    totalClp: 120_000,
    createdAt: new Date(),
    guestComment: null,
    externalPlatform: null,
    guest: {
      firstName: "Huesped",
      lastName: "Airbnb",
      email: "vistavallespa@gmail.com",
      phone: "+56 9 1111 1111",
      rut: null,
      company: null,
    },
    items: [],
    payments: [],
    channelSyncTasks: [],
    auditEvents: [],
    ...overrides,
  };
}

describe("Admin reservation detail — channel-sync guest note", () => {
  it("shows a note that the guest contact is a placeholder for a synced reservation", async () => {
    mocks.detail.mockResolvedValue(
      baseDetail({ externalPlatform: "airbnb" })
    );
    render(
      await ReservationDetail({
        params: Promise.resolve({ id: "reservation-1" }),
      })
    );
    expect(
      screen.getByText(/Datos provisionales generados automáticamente/)
    ).toBeInTheDocument();
    expect(screen.getByText(/sincronización con Airbnb/)).toBeInTheDocument();
  });

  it("shows no such note for a reservation with a real guest", async () => {
    mocks.detail.mockResolvedValue(
      baseDetail({
        externalPlatform: null,
        origin: "website",
        guest: {
          firstName: "Ana",
          lastName: "Pérez",
          email: "ana@example.com",
          phone: "+56 9 2222 2222",
          rut: null,
          company: null,
        },
      })
    );
    render(
      await ReservationDetail({
        params: Promise.resolve({ id: "reservation-1" }),
      })
    );
    expect(
      screen.queryByText(/Datos provisionales generados automáticamente/)
    ).not.toBeInTheDocument();
  });
});
