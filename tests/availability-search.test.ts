import { describe, expect, it } from "vitest";

import {
  createMockAvailabilityRepository,
  searchAvailability,
  AvailabilitySearchInputError,
  SelectedRoomUnavailableError,
} from "@/features/availability";
import { createAvailabilitySearchRepository } from "@/features/availability/search-source";
import { mockDemoRooms, createRoomReadSource } from "@/features/rooms";

const roomSource = createRoomReadSource("mock", mockDemoRooms);

describe("authoritative availability search", () => {
  it("fails closed when a production availability source is not configured", () => {
    expect(() => createAvailabilitySearchRepository("production")).toThrow(
      "Availability search source is not configured"
    );
    expect(createAvailabilitySearchRepository("mock")).toBeDefined();
  });

  it("filters publishable rooms by availability only, never by total party capacity", async () => {
    const result = await searchAvailability(
      { checkIn: "2026-10-05", checkOut: "2026-10-08", guests: "2" },
      {
        availabilityRepository: createMockAvailabilityRepository({
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
        }),
        roomSource,
      }
    );
    // demo-room-valle (capacity 1) is reserved, so it's excluded; both
    // demo-room-andes (capacity 1) and demo-room-terra (capacity 2) appear
    // even though neither, alone, has capacity >= the 2 guests searched -
    // the visitor is expected to split the party across them.
    expect(result.rooms.map((room) => room.slug)).toEqual([
      "habitacion-andes-demo",
      "habitacion-terra-demo",
    ]);
  });

  it("honours a preselected room by slug and rejects it clearly when unavailable", async () => {
    await expect(
      searchAvailability(
        {
          checkIn: "2026-10-05",
          checkOut: "2026-10-08",
          guests: 2,
          room: "habitacion-valle-demo",
        },
        {
          availabilityRepository: createMockAvailabilityRepository({
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
          }),
          roomSource,
        }
      )
    ).rejects.toBeInstanceOf(SelectedRoomUnavailableError);
  });

  it("accepts same-day turnover and never trusts malformed dates or guest counts", async () => {
    const dependencies = {
      availabilityRepository: createMockAvailabilityRepository({
        blocks: [],
        holds: [],
        reservations: [
          {
            checkIn: "2026-10-01",
            checkOut: "2026-10-05",
            id: "r1",
            roomId: "demo-room-valle",
            status: "confirmed",
          },
        ],
      }),
      roomSource,
    };
    const result = await searchAvailability(
      { checkIn: "2026-10-05", checkOut: "2026-10-06", guests: 1 },
      dependencies
    );
    expect(
      result.rooms.some((room) => room.slug === "habitacion-valle-demo")
    ).toBe(true);
    await expect(
      searchAvailability(
        { checkIn: "2026-10-06", checkOut: "2026-10-05", guests: 1 },
        dependencies
      )
    ).rejects.toBeInstanceOf(AvailabilitySearchInputError);
    await expect(
      searchAvailability(
        { checkIn: "2026-10-05", checkOut: "2026-10-06", guests: "0" },
        dependencies
      )
    ).rejects.toBeInstanceOf(AvailabilitySearchInputError);
  });

  it("rejects public dates before today and accepts today through tomorrow", async () => {
    const dependencies = {
      availabilityRepository: createMockAvailabilityRepository({
        blocks: [],
        holds: [],
        reservations: [],
      }),
      roomSource,
    };
    const now = new Date("2030-01-10T03:30:00.000Z");

    await expect(
      searchAvailability(
        { checkIn: "2030-01-09", checkOut: "2030-01-11", guests: 1 },
        dependencies,
        now
      )
    ).rejects.toThrow("La fecha de entrada no puede ser anterior a hoy.");
    await expect(
      searchAvailability(
        { checkIn: "2030-01-10", checkOut: "2030-01-11", guests: 1 },
        dependencies,
        now
      )
    ).resolves.toMatchObject({ checkIn: "2030-01-10", checkOut: "2030-01-11" });
  });
});
