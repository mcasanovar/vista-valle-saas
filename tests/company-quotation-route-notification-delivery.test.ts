import { describe, expect, it, vi } from "vitest";

import { getMockNotificationOutboxIntents } from "@/features/notifications";
import { POST } from "../app/api/company-quotations/route";

const body = {
  breakfastRequested: false,
  checkIn: "2026-12-05",
  checkOut: "2026-12-08",
  company: "Empresa entrega inmediata",
  contact: "Ana Pérez",
  email: "ana-delivery@example.com",
  guestCount: 3,
  message: "Mensaje",
  requireParking: false,
  rooms: [
    { guestCount: 1, quantity: 1, slug: "habitacion-valle-demo" },
    { guestCount: 2, quantity: 1, slug: "habitacion-terra-demo" },
  ],
};

describe("company quotation route - immediate notification delivery", () => {
  it("delivers both the customer and admin notifications right after a successful POST, without the internal outbox endpoint being invoked", async () => {
    const response = await POST(
      new Request("http://localhost/api/company-quotations", {
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "route-quotation-delivery-1",
        },
        method: "POST",
      })
    );
    const { id: quotationId } = (await response.json()) as {
      id: string;
    };

    expect(response.status).toBe(201);

    await vi.waitFor(() => {
      const intents = getMockNotificationOutboxIntents().filter(
        (intent) => intent.quotationId === quotationId
      );
      expect(intents).toHaveLength(2);
      expect(intents.every((intent) => intent.status === "delivered")).toBe(
        true
      );
    });
  });
});
