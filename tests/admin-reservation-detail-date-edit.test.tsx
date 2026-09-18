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
vi.mock("@/features/admin/edit-reservation-dates-action", () => ({
  editAdminReservationDatesAction: vi.fn(),
}));
vi.mock("@/features/admin/edit-reservation-dates-form", () => ({
  EditReservationDatesForm: () => (
    <form aria-label="Editar fechas de la reserva" />
  ),
}));
vi.mock("@/features/admin/edit-reservation-guest-contact-action", () => ({
  editReservationGuestContactAction: vi.fn(),
}));
vi.mock("@/features/admin/edit-reservation-guest-contact-form", () => ({
  EditReservationGuestContactForm: () => (
    <form aria-label="Editar datos del huésped" />
  ),
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
    origin: "website",
    checkIn: "2026-11-01",
    checkOut: "2026-11-03",
    totalClp: 120_000,
    createdAt: new Date(),
    guestComment: null,
    externalPlatform: null,
    guest: {
      firstName: "Ana",
      lastName: "Pérez",
      email: "ana@example.com",
      phone: "+56 9 2222 2222",
      rut: null,
      company: null,
    },
    items: [
      { roomId: "room-1", roomName: "Valle", nights: 2, subtotalClp: 120_000 },
    ],
    payments: [],
    channelSyncTasks: [],
    auditEvents: [],
    ...overrides,
  };
}

async function renderDetail(overrides: Partial<Record<string, unknown>> = {}) {
  mocks.detail.mockResolvedValue(baseDetail(overrides));
  render(
    await ReservationDetail({
      params: Promise.resolve({ id: "reservation-1" }),
    })
  );
}

describe("admin reservation detail — date edit eligibility", () => {
  it.each([
    "website",
    "phone",
    "whatsapp",
    "admin",
    "airbnb",
    "booking",
  ] as const)(
    "shows the date edit form for a confirmed %s reservation",
    async (origin) => {
      await renderDetail({ origin });
      expect(
        screen.getByRole("form", { name: "Editar fechas de la reserva" })
      ).toBeInTheDocument();
    }
  );

  it.each(["cancelled", "completed", "no_show"] as const)(
    "still shows the date edit form for a %s reservation regardless of origin",
    async (status) => {
      await renderDetail({ status, origin: "airbnb" });
      expect(
        screen.getByRole("form", { name: "Editar fechas de la reserva" })
      ).toBeInTheDocument();
    }
  );

  it("shows an overpayment alert when approved payments exceed the current total", async () => {
    await renderDetail({
      totalClp: 100_000,
      payments: [
        {
          id: "payment-1",
          provider: "pay_at_property",
          status: "approved",
          amountClp: 150_000,
          refundedAmountClp: 0,
        },
      ],
    });
    expect(screen.getByRole("alert")).toHaveTextContent("sobrepago");
  });

  it("shows no overpayment alert when the balance is settled", async () => {
    await renderDetail({
      totalClp: 100_000,
      payments: [
        {
          id: "payment-1",
          provider: "pay_at_property",
          status: "approved",
          amountClp: 100_000,
          refundedAmountClp: 0,
        },
      ],
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
