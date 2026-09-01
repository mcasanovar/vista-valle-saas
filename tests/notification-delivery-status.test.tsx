import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  alerts: vi.fn(),
  deliveries: vi.fn(),
}));

vi.mock("@/features/admin/operational-alerts", () => ({
  getOperationalAlerts: mocks.alerts,
}));
vi.mock(
  "@/features/admin/notification-delivery-status",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/features/admin/notification-delivery-status")
    >()),
    getNotificationDeliveryStatuses: mocks.deliveries,
  })
);

import AlertsPage from "../app/(admin-protected)/admin/alertas/page";
import { mapNotificationDeliveryStatuses } from "@/features/admin/notification-delivery-status";

describe("admin notification delivery status", () => {
  it("maps failed/retrying delivery state without recipients, reservation IDs, or references", () => {
    const statuses = mapNotificationDeliveryStatuses([
      {
        attempts: 2,
        createdAt: new Date(),
        id: "outbox-private",
        lastErrorCode: "delivery_transient",
        nextAttemptAt: new Date("2053-01-01T00:01:00.000Z"),
        paymentId: "payment-private",
        recipient: "guest@example.test",
        reservationId: "reservation-private",
        status: "retrying",
        type: "reservation_confirmed_guest",
      },
    ]);

    expect(statuses).toEqual([
      {
        attempts: 2,
        errorCode: "delivery_transient",
        nextAttemptAt: new Date("2053-01-01T00:01:00.000Z"),
        status: "retrying",
      },
    ]);
    expect(JSON.stringify(statuses)).not.toMatch(
      /guest@example|reservation-private|payment-private|outbox-private/
    );
  });

  it("renders only safe failed delivery metadata in the protected admin view", async () => {
    mocks.alerts.mockResolvedValue([]);
    mocks.deliveries.mockReturnValue([
      {
        attempts: 3,
        errorCode: "delivery_permanent",
        status: "failed",
      },
    ]);

    render(await AlertsPage());

    expect(
      screen.getByRole("heading", { name: "Entregas de notificaciones" })
    ).toBeVisible();
    expect(screen.getByText(/Entrega fallida: intento 3/)).toBeVisible();
    expect(screen.getByText(/código delivery_permanent/)).toBeVisible();
    expect(
      screen.queryByText(
        /guest@example|reservation-private|payment-private|outbox-private/
      )
    ).not.toBeInTheDocument();
  });
});
