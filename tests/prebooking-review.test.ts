import { describe, expect, it } from "vitest";
import { createMockAvailabilityRepository } from "@/features/availability";
import { mockDemoRooms } from "@/features/rooms";
import { composePrebookingReview } from "@/features/reservations";

const roomSource = {
  getActiveBySlug: (slug: string) =>
    mockDemoRooms.find((room) => room.slug === slug) ?? null,
  listActive: () => mockDemoRooms,
};

describe("prebooking review composition", () => {
  it("revalidates every selected room and derives multi-room subtotals from server room data", async () => {
    const result = await composePrebookingReview(
      {
        checkIn: "2032-02-10",
        checkOut: "2032-02-13",
        guests: "1",
        rooms: "habitacion-valle-demo,habitacion-andes-demo",
        totalClp: "1",
      },
      {
        availabilityRepository: createMockAvailabilityRepository({
          blocks: [],
          holds: [],
          reservations: [],
        }),
        roomSource,
      }
    );

    expect(result).toMatchObject({
      kind: "ready",
      nights: 3,
      totalClp: 345_000,
      rooms: [
        { slug: "habitacion-valle-demo", subtotalClp: 165_000 },
        { slug: "habitacion-andes-demo", subtotalClp: 180_000 },
      ],
    });
  });

  it("returns a recoverable stale state when any selected room becomes occupied", async () => {
    const result = await composePrebookingReview(
      {
        checkIn: "2032-02-10",
        checkOut: "2032-02-13",
        guests: "1",
        rooms: "habitacion-valle-demo,habitacion-andes-demo",
      },
      {
        availabilityRepository: createMockAvailabilityRepository({
          blocks: [],
          holds: [],
          reservations: [
            {
              checkIn: "2032-02-11",
              checkOut: "2032-02-12",
              id: "occupied",
              roomId: "demo-room-andes",
              status: "confirmed",
            },
          ],
        }),
        roomSource,
      }
    );

    expect(result).toMatchObject({ kind: "stale" });
  });
});
