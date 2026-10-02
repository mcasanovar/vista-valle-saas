import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  originAction: vi.fn(),
  detail: vi.fn(),
  rateAction: vi.fn(),
}));
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
vi.mock("@/features/admin/edit-reservation-stay-action", () => ({
  editAdminReservationStayAction: vi.fn(),
}));
vi.mock("@/features/admin/edit-reservation-stay-form", () => ({
  EditReservationStayForm: () => (
    <form aria-label="Editar estadía de la reserva" />
  ),
}));
vi.mock("@/infrastructure/database/channel-connections-repository", () => ({
  createDrizzleChannelConnectionRepository: () => ({
    listActive: async () => [],
  }),
}));
vi.mock("@/features/admin/edit-reservation-guest-contact-action", () => ({
  editReservationGuestContactAction: vi.fn(),
}));
vi.mock("@/features/admin/edit-reservation-guest-contact-form", () => ({
  EditReservationGuestContactForm: () => (
    <form aria-label="Editar datos del huésped" />
  ),
}));
vi.mock("@/features/admin/edit-reservation-invoice-action", () => ({
  editReservationInvoiceAction: vi.fn(),
}));
vi.mock("@/features/admin/edit-reservation-invoice-form", () => ({
  EditReservationInvoiceForm: () => <form aria-label="Editar facturación" />,
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
vi.mock("@/features/admin/edit-reservation-nightly-rates-action", () => ({
  editAdminReservationNightlyRatesAction: mocks.rateAction,
}));
vi.mock("@/features/admin/edit-reservation-origin-action", () => ({
  editAdminReservationOriginAction: mocks.originAction,
}));

import ReservationDetail from "../app/(admin-protected)/admin/reservas/[id]/page";
import { ToastProvider } from "@/presentation/organisms";

function baseDetail(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "reservation-1",
    publicId: "VV-abc",
    status: "confirmed",
    origin: "booking",
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
      {
        nightlyPriceClp: 60_000,
        nightlyPriceManual: false,
        nights: 2,
        roomId: "room-1",
        roomName: "Valle",
        subtotalClp: 120_000,
      },
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
    <ToastProvider>
      {await ReservationDetail({
        params: Promise.resolve({ id: "reservation-1" }),
      })}
    </ToastProvider>
  );
}

describe("nightly value editor in the detail (task 7.3)", () => {
  it.each(["airbnb", "booking"] as const)(
    "renders the editor for a %s reservation",
    async (origin) => {
      await renderDetail({ origin });
      expect(
        screen.getByRole("form", { name: "Editar valor por noche" })
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Valle")).toHaveAttribute(
        "name",
        "rate:room-1"
      );
    }
  );

  it.each(["website", "phone", "whatsapp", "admin"] as const)(
    "does not render the editor for a %s reservation",
    async (origin) => {
      await renderDetail({ origin });
      expect(
        screen.queryByRole("form", { name: "Editar valor por noche" })
      ).not.toBeInTheDocument();
    }
  );

  it.each(["cancelled", "completed", "no_show"] as const)(
    "renders the editor for a %s external-channel reservation",
    async (status) => {
      await renderDetail({ origin: "booking", status });
      expect(
        screen.getByRole("form", { name: "Editar valor por noche" })
      ).toBeInTheDocument();
    }
  );

  it("prefills the field with the hand-set value and leaves it empty otherwise", async () => {
    await renderDetail({
      items: [
        {
          nightlyPriceClp: 42_000,
          nightlyPriceManual: true,
          nights: 2,
          roomId: "room-1",
          roomName: "Valle",
          subtotalClp: 84_000,
        },
      ],
    });
    expect(screen.getByLabelText("Valle")).toHaveValue("42000");
  });

  it("offers going back to the current rate by emptying the field", async () => {
    await renderDetail();
    // An empty field is the documented way to drop the hand-set value.
    expect(screen.getByLabelText("Valle")).toHaveValue("");
    expect(
      screen.getByText(/deja el campo vacío para volver a la tarifa vigente/i)
    ).toBeInTheDocument();
  });
});

describe("manual value is visually distinct (task 7.4)", () => {
  it("marks a hand-set value in the rooms list", async () => {
    await renderDetail({
      items: [
        {
          nightlyPriceClp: 42_000,
          nightlyPriceManual: true,
          nights: 2,
          roomId: "room-1",
          roomName: "Valle",
          subtotalClp: 84_000,
        },
      ],
    });
    expect(screen.getByTestId("manual-rate-room-1")).toHaveTextContent(
      "Valor fijado a mano"
    );
    expect(screen.getByTestId("manual-badge-room-1")).toBeInTheDocument();
  });

  it("does not mark a value resolved from the room's rate", async () => {
    await renderDetail();
    expect(screen.queryByTestId("manual-rate-room-1")).not.toBeInTheDocument();
    expect(screen.getByTestId("rate-badge-room-1")).toHaveTextContent(
      "Tarifa vigente"
    );
  });
});

describe("origin correction in the detail (task 7.5)", () => {
  it.each([
    "website",
    "airbnb",
    "booking",
    "phone",
    "whatsapp",
    "admin",
  ] as const)(
    "renders the origin form for a %s reservation with that origin selected",
    async (origin) => {
      await renderDetail({ origin });
      expect(
        screen.getByRole("form", { name: "Corregir origen" })
      ).toBeInTheDocument();
      expect(screen.getByLabelText("Origen de la reserva")).toHaveValue(origin);
    }
  );

  it("offers all six origins as targets", async () => {
    await renderDetail({ origin: "admin" });
    const options = screen
      .getAllByRole("option")
      .map((option) => (option as HTMLOptionElement).value);
    expect(options).toEqual([
      "website",
      "airbnb",
      "booking",
      "phone",
      "whatsapp",
      "admin",
    ]);
  });

  it("lets an administración reservation be corrected to Booking", async () => {
    await renderDetail({ origin: "admin" });
    const select = screen.getByLabelText("Origen de la reserva");
    expect(
      [...(select as HTMLSelectElement).options].map((o) => o.value)
    ).toContain("booking");
  });
});
