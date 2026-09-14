import { describe, expect, it, vi } from "vitest";

import {
  createMockAvailabilityRepository,
  serializeAvailabilityResultsQuery,
  validateAvailabilityResultsQuery,
} from "@/features/availability";
import { composeAvailabilityResults } from "@/features/availability/results-service";
import { createRoomReadSource, mockDemoRooms } from "@/features/rooms";

const roomSource = createRoomReadSource("mock", mockDemoRooms);

function validQuery(overrides: Record<string, string> = {}) {
  return validateAvailabilityResultsQuery({
    checkIn: "2026-10-05",
    checkOut: "2026-10-08",
    guests: "2",
    ...overrides,
  });
}

describe("availability results query contract", () => {
  it("normalizes canonical criteria and serializes only safe criteria", () => {
    const validation = validQuery({ room: "habitacion-andes-demo" });
    expect(validation).toMatchObject({
      ok: true,
      value: {
        checkIn: "2026-10-05",
        checkOut: "2026-10-08",
        guests: 2,
        room: "habitacion-andes-demo",
      },
    });
    if (!validation.ok) throw new Error("Expected a valid query");
    expect(serializeAvailabilityResultsQuery(validation.value)).toBe(
      "/disponibilidad?checkIn=2026-10-05&checkOut=2026-10-08&guests=2&room=habitacion-andes-demo"
    );
  });

  it("reports direct URL errors by field without producing a query", () => {
    const validation = validateAvailabilityResultsQuery({
      checkIn: "2026-10-08",
      checkOut: "2026-10-05",
      guests: "21",
      room: ["habitacion-valle-demo", "habitacion-andes-demo"],
    });
    expect(validation).toMatchObject({
      ok: false,
      errors: {
        checkOut: { code: "NOT_ORDERED" },
        guests: { code: "OUT_OF_RANGE" },
        room: { code: "MALFORMED" },
      },
    });
  });

  it("distinguishes missing and malformed criteria from limits", () => {
    const missing = validateAvailabilityResultsQuery({});
    expect(missing).toMatchObject({
      ok: false,
      errors: {
        checkIn: { code: "MISSING" },
        checkOut: { code: "MISSING" },
        guests: { code: "MISSING" },
      },
    });

    const malformed = validateAvailabilityResultsQuery({
      checkIn: "2026-02-30",
      checkOut: "2026-10-08",
      guests: "two",
    });
    expect(malformed).toMatchObject({
      ok: false,
      errors: {
        checkIn: { code: "MALFORMED" },
        guests: { code: "MALFORMED" },
      },
    });
  });

  it("rejects past arrivals and invalid public departures using Santiago minimums", () => {
    const now = new Date("2030-01-10T03:30:00.000Z");
    const past = validateAvailabilityResultsQuery(
      { checkIn: "2030-01-09", checkOut: "2030-01-11", guests: "1" },
      now
    );
    const todayAndTomorrow = validateAvailabilityResultsQuery(
      { checkIn: "2030-01-10", checkOut: "2030-01-11", guests: "1" },
      now
    );
    const invalidDeparture = validateAvailabilityResultsQuery(
      { checkIn: "2030-01-10", checkOut: "2030-01-10", guests: "1" },
      now
    );

    expect(past).toMatchObject({
      ok: false,
      errors: {
        checkIn: {
          code: "OUT_OF_RANGE",
          message: "La fecha de entrada no puede ser anterior a hoy.",
        },
      },
    });
    expect(todayAndTomorrow).toMatchObject({ ok: true });
    expect(invalidDeparture).toMatchObject({
      ok: false,
      errors: {
        checkOut: {
          code: "NOT_ORDERED",
          message: "La fecha de salida debe ser posterior a la entrada.",
        },
      },
    });
  });

  it("refuses to serialize values outside the canonical contract", () => {
    expect(() =>
      serializeAvailabilityResultsQuery({
        checkIn: "2026-10-05" as never,
        checkOut: "2026-10-08" as never,
        guests: 2,
        room: "guest-email@example.com",
      })
    ).toThrow("Cannot serialize an invalid availability results query");
  });
});

describe("server-only availability results composition", () => {
  it("returns complete configured details only for rooms authorized as available", async () => {
    const result = await composeAvailabilityResults(validQuery(), {
      availabilityRepository: createMockAvailabilityRepository({
        blocks: [],
        holds: [],
        reservations: [
          {
            checkIn: "2026-10-05",
            checkOut: "2026-10-08",
            id: "reservation-1",
            roomId: "demo-room-valle",
            status: "confirmed",
          },
        ],
      }),
      roomSource,
    });
    expect(result).toMatchObject({ kind: "results" });
    if (result.kind !== "results") throw new Error("Expected results");
    // demo-room-valle is reserved and excluded; demo-room-andes still
    // appears even though its capacity (1) is below the 2 guests searched -
    // the visitor can pair it with another room to complete the party.
    expect(result.rooms.map((room) => room.slug)).toEqual([
      "habitacion-andes-demo",
      "habitacion-terra-demo",
    ]);
    expect(result.rooms[0]).toMatchObject({
      amenities: expect.any(Array),
      bathroom: expect.any(String),
      bedConfiguration: expect.any(String),
      images: expect.any(Array),
      nightlyPriceClp: expect.any(Number),
    });
  });

  it("never filters by total party capacity, represents no results only when nothing is available, and distinguishes an unavailable preselection", async () => {
    const dependencies = {
      availabilityRepository: createMockAvailabilityRepository({
        blocks: [],
        holds: [],
        reservations: [],
      }),
      roomSource,
    };
    // No single demo room has capacity 3, yet all remain candidates: the
    // visitor is expected to split a 3-guest party across several rooms.
    const largerParty = await composeAvailabilityResults(
      validQuery({ guests: "3" }),
      dependencies
    );
    expect(largerParty).toMatchObject({ kind: "results" });
    if (largerParty.kind !== "results") throw new Error("Expected results");
    expect(largerParty.rooms.map((room) => room.slug).sort()).toEqual([
      "habitacion-andes-demo",
      "habitacion-terra-demo",
      "habitacion-valle-demo",
    ]);

    const noResults = await composeAvailabilityResults(validQuery(), {
      ...dependencies,
      availabilityRepository: createMockAvailabilityRepository({
        blocks: [],
        holds: [],
        reservations: [
          {
            checkIn: "2026-10-05",
            checkOut: "2026-10-08",
            id: "reservation-3",
            roomId: "demo-room-valle",
            status: "confirmed",
          },
          {
            checkIn: "2026-10-05",
            checkOut: "2026-10-08",
            id: "reservation-4",
            roomId: "demo-room-andes",
            status: "confirmed",
          },
          {
            checkIn: "2026-10-05",
            checkOut: "2026-10-08",
            id: "reservation-5",
            roomId: "demo-room-terra",
            status: "confirmed",
          },
        ],
      }),
    });
    expect(noResults).toMatchObject({ kind: "results", rooms: [] });

    const unavailable = await composeAvailabilityResults(
      validQuery({ guests: "1", room: "habitacion-valle-demo" }),
      {
        ...dependencies,
        availabilityRepository: createMockAvailabilityRepository({
          blocks: [],
          holds: [],
          reservations: [
            {
              checkIn: "2026-10-05",
              checkOut: "2026-10-08",
              id: "reservation-2",
              roomId: "demo-room-valle",
              status: "confirmed",
            },
          ],
        }),
      }
    );
    expect(unavailable).toMatchObject({
      kind: "selected-room-unavailable",
      message: expect.stringContaining("no está disponible"),
    });
  });

  it("does not invoke external providers under mock dependencies", async () => {
    const listOccupyingIntervals = vi.fn().mockResolvedValue([]);
    const listActive = vi.fn(() => mockDemoRooms);
    const result = await composeAvailabilityResults(validQuery(), {
      availabilityRepository: { listOccupyingIntervals },
      roomSource: {
        getActiveBySlug: () => null,
        listActive,
      },
    });

    expect(result).toMatchObject({ kind: "results" });
    // One call per candidate room - all 3 demo rooms, since availability is
    // no longer pre-filtered by total party capacity.
    expect(listOccupyingIntervals).toHaveBeenCalledTimes(3);
    expect(listActive).toHaveBeenCalled();
  });
});
