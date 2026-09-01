import { beforeEach, describe, expect, it, vi } from "vitest";

import { createMockAvailabilityRepository } from "@/features/availability";

const getAvailabilitySearchRepository = vi.fn();

vi.mock("@/features/availability/search-source", () => ({
  getAvailabilitySearchRepository: () => getAvailabilitySearchRepository(),
}));

function request(params: Readonly<Record<string, string>>) {
  const search = new URLSearchParams(params);
  return new Request(
    `http://localhost/api/company-quotations/availability?${search.toString()}`
  );
}

describe("company quotation availability route", () => {
  beforeEach(() => {
    getAvailabilitySearchRepository.mockReset();
  });

  it("rejects missing or invalid query parameters without a 500", async () => {
    getAvailabilitySearchRepository.mockReturnValue(
      createMockAvailabilityRepository({
        blocks: [],
        holds: [],
        reservations: [],
      })
    );
    const { GET } =
      await import("../app/api/company-quotations/availability/route");

    const response = await GET(
      request({ checkIn: "", checkOut: "2026-10-08", guestCount: "2" })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      code: "INVALID_COMPANY_QUOTATION_AVAILABILITY_INPUT",
      message: "Selecciona fechas de entrada y salida válidas.",
    });
  });

  it("reports total availability when no room is occupied", async () => {
    getAvailabilitySearchRepository.mockReturnValue(
      createMockAvailabilityRepository({
        blocks: [],
        holds: [],
        reservations: [],
      })
    );
    const { GET } =
      await import("../app/api/company-quotations/availability/route");

    const response = await GET(
      request({
        checkIn: "2026-10-05",
        checkOut: "2026-10-08",
        guestCount: "3",
      })
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.totalAvailableRooms).toBe(3);
    expect(body.totalAvailableCapacity).toBe(4);
    expect(body.coversGuestCount).toBe(true);
  });

  it("reports partial availability when some rooms are occupied", async () => {
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
    const { GET } =
      await import("../app/api/company-quotations/availability/route");

    const response = await GET(
      request({
        checkIn: "2026-10-05",
        checkOut: "2026-10-08",
        guestCount: "3",
      })
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.totalAvailableRooms).toBe(2);
    expect(body.totalAvailableCapacity).toBe(3);
    expect(body.coversGuestCount).toBe(true);
  });

  it("reports zero availability when every room is occupied", async () => {
    getAvailabilitySearchRepository.mockReturnValue(
      createMockAvailabilityRepository({
        blocks: [],
        holds: [],
        reservations: [
          "demo-room-valle",
          "demo-room-andes",
          "demo-room-terra",
        ].map((roomId, index) => ({
          checkIn: "2026-10-05",
          checkOut: "2026-10-08",
          id: `r${index}`,
          roomId,
          status: "confirmed" as const,
        })),
      })
    );
    const { GET } =
      await import("../app/api/company-quotations/availability/route");

    const response = await GET(
      request({
        checkIn: "2026-10-05",
        checkOut: "2026-10-08",
        guestCount: "1",
      })
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body.rooms).toEqual([]);
    expect(body.totalAvailableRooms).toBe(0);
    expect(body.coversGuestCount).toBe(false);
  });
});
