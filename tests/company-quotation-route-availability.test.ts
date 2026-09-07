import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockAvailabilityRepository } from "@/features/availability";

const getAvailabilitySearchRepository = vi.fn();

vi.mock("@/features/availability/search-source", () => ({
  getAvailabilitySearchRepository: () => getAvailabilitySearchRepository(),
}));

const body = {
  breakfastRequested: false,
  checkIn: "2026-10-05",
  checkOut: "2026-10-08",
  company: "Empresa demo",
  contact: "Ana Pérez",
  email: "ana@example.com",
  guestCount: 1,
  message: "Mensaje",
  requireParking: false,
  rooms: [{ quantity: 1, slug: "habitacion-valle-demo" }],
};

function request(overrides: Partial<typeof body> = {}, idempotencyKey = "x") {
  return new Request("http://localhost/api/company-quotations", {
    body: JSON.stringify({ ...body, ...overrides }),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    method: "POST",
  });
}

describe("company quotation route availability re-check", () => {
  beforeEach(() => {
    getAvailabilitySearchRepository.mockReset();
  });

  it("rejects a submission when the requested room was booked after the client saw availability", async () => {
    getAvailabilitySearchRepository.mockReturnValue(
      createMockAvailabilityRepository({
        blocks: [],
        holds: [],
        reservations: [
          {
            checkIn: "2026-10-05",
            checkOut: "2026-10-08",
            id: "r1",
            roomId: "demo-room-valle",
            status: "confirmed",
          },
        ],
      })
    );
    const { POST } = await import("../app/api/company-quotations/route");

    const response = await POST(request());
    const responseBody = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(responseBody.code).toBe("COMPANY_QUOTATION_AVAILABILITY_EXCEEDED");
    expect(responseBody.availableUnits).toBe(0);
  });

  it("accepts a submission whose requested rooms are still free at submit time", async () => {
    getAvailabilitySearchRepository.mockReturnValue(
      createMockAvailabilityRepository({
        blocks: [],
        holds: [],
        reservations: [],
      })
    );
    const { POST } = await import("../app/api/company-quotations/route");

    const response = await POST(request({}, "route-quotation-still-free"));

    expect(response.status).toBe(201);
  });
});
