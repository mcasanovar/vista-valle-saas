import { describe, expect, it } from "vitest";

import { POST } from "../app/api/company-quotations/route";

const body = {
  breakfastRequested: false,
  checkIn: "2026-10-05",
  checkOut: "2026-10-08",
  company: "Empresa demo",
  contact: "Ana Pérez",
  email: "ana@example.com",
  guestCount: 3,
  message: "Mensaje",
  requireParking: false,
  rooms: [
    { quantity: 1, slug: "habitacion-valle-demo" },
    { quantity: 1, slug: "habitacion-terra-demo" },
  ],
};

describe("company quotation route", () => {
  it("returns a server-calculated public quote and is idempotent", async () => {
    const request = () =>
      new Request("http://localhost/api/company-quotations", {
        body: JSON.stringify(body),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "route-quotation-1",
        },
        method: "POST",
      });

    const first = await POST(request());
    const repeated = await POST(request());
    const firstBody = (await first.json()) as Record<string, unknown>;
    const repeatedBody = (await repeated.json()) as Record<string, unknown>;

    expect(first.status).toBe(201);
    expect(firstBody.totalClp).toBe(375000);
    expect(firstBody).not.toHaveProperty("email");
    expect(repeatedBody.id).toBe(firstBody.id);
  });

  it("accepts and persists a partial quotation when capacity falls short of guests", async () => {
    const response = await POST(
      new Request("http://localhost/api/company-quotations", {
        body: JSON.stringify({
          ...body,
          guestCount: 3,
          rooms: [{ quantity: 1, slug: "habitacion-valle-demo" }],
        }),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "route-quotation-partial",
        },
        method: "POST",
      })
    );
    const responseBody = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(201);
    expect(responseBody.capacity).toBe(1);
    expect(responseBody.guestCount).toBe(3);
  });
});
