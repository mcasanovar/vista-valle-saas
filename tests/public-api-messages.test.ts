import { afterEach, describe, expect, it, vi } from "vitest";
import { createMockAvailabilityRepository } from "@/features/availability";

const getAvailabilitySearchRepository = vi.hoisted(() => vi.fn());

vi.mock("@/features/availability/search-source", () => ({
  getAvailabilitySearchRepository: () => getAvailabilitySearchRepository(),
}));

import { GET as availabilityGet } from "../app/api/availability/route";
import { GET as bookingSummaryGet } from "../app/api/booking-summary/route";
import { POST as quotationPost } from "../app/api/company-quotations/route";

afterEach(() => {
  vi.useRealTimers();
  getAvailabilitySearchRepository.mockReset();
});

describe("public API messages", () => {
  it("returns Spanish validation messages for availability and booking summary", async () => {
    const availability = await availabilityGet(
      new Request(
        "http://localhost/api/availability?checkIn=&checkOut=&guests=0"
      )
    );
    const summary = await bookingSummaryGet(
      new Request("http://localhost/api/booking-summary?room=missing")
    );

    expect(await availability.json()).toEqual({
      code: "INVALID_AVAILABILITY_SEARCH",
      message: "Selecciona fechas de entrada y salida válidas.",
    });
    expect(await summary.json()).toEqual({
      message: "La habitación seleccionada ya no está disponible.",
    });
  });

  it("normalizes unexpected availability failures without exposing internals", async () => {
    getAvailabilitySearchRepository.mockReturnValue({
      listOccupyingIntervals: async () => {
        throw new Error("database password leaked");
      },
    });

    const response = await availabilityGet(
      new Request(
        "http://localhost/api/availability?checkIn=2032-02-10&checkOut=2032-02-13&guests=1"
      )
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      code: "AVAILABILITY_SEARCH_FAILED",
      message: "No pudimos consultar disponibilidad. Intenta nuevamente.",
    });
  });

  it("rejects a past public arrival at the availability API boundary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2030-01-10T03:30:00.000Z"));
    getAvailabilitySearchRepository.mockReturnValue(
      createMockAvailabilityRepository({
        blocks: [],
        holds: [],
        reservations: [],
      })
    );

    const response = await availabilityGet(
      new Request(
        "http://localhost/api/availability?checkIn=2030-01-09&checkOut=2030-01-11&guests=1"
      )
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      code: "INVALID_AVAILABILITY_SEARCH",
      message: "La fecha de entrada no puede ser anterior a hoy.",
    });
  });

  it("returns Spanish quotation validation without technical details", async () => {
    const response = await quotationPost(
      new Request("http://localhost/api/company-quotations", {
        body: JSON.stringify({}),
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": "quote-invalid",
        },
        method: "POST",
      })
    );
    const body = (await response.json()) as {
      issues: readonly { message: string }[];
      message: string;
    };

    expect(response.status).toBe(400);
    expect(body.message).toBe("La solicitud de cotización no es válida.");
    expect(
      body.issues.every(
        (issue) => !/required|invalid|must/i.test(issue.message)
      )
    ).toBe(true);
  });
});
