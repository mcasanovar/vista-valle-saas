import { describe, expect, it, vi } from "vitest";

const { processByIds } = vi.hoisted(() => ({
  processByIds: vi.fn(),
}));

vi.mock("@/infrastructure/database/notification-processor-source", () => ({
  getServerScheduledOutboxProcessor: () => ({ processByIds }),
}));

import { POST } from "../app/api/company-quotations/route";

const body = {
  breakfastRequested: false,
  checkIn: "2026-11-05",
  checkOut: "2026-11-08",
  company: "Empresa timing",
  contact: "Ana Pérez",
  email: "ana-timing@example.com",
  guestCount: 3,
  message: "Mensaje",
  requireParking: false,
  rooms: [
    { guestCount: 1, quantity: 1, slug: "habitacion-valle-demo" },
    { guestCount: 2, quantity: 1, slug: "habitacion-terra-demo" },
  ],
};

describe("company quotation route - notification delivery timing", () => {
  it("responds to the client without waiting for the immediate delivery attempt to settle", async () => {
    let deliveryCompleted = false;
    processByIds.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            deliveryCompleted = true;
            resolve();
          }, 50);
        })
    );

    const response = await POST(
      new Request("http://localhost/api/company-quotations", {
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "route-quotation-timing-1",
        },
        method: "POST",
      })
    );

    expect(response.status).toBe(201);
    expect(deliveryCompleted).toBe(false);
    expect(processByIds).toHaveBeenCalledTimes(1);
    expect(processByIds.mock.calls[0]![0]).toHaveLength(2);

    await vi.waitFor(() => expect(deliveryCompleted).toBe(true));
  });
});
