import { describe, expect, it } from "vitest";

import { createMockAvailabilityRepository } from "@/features/availability";
import {
  CompanyQuotationAvailabilityInputError,
  resolveCompanyQuotationAvailability,
} from "@/features/company-quotations";
import { createRoomReadSource, mockDemoRooms } from "@/features/rooms";

const roomSource = createRoomReadSource("mock", mockDemoRooms);

function countingRepository(
  base: ReturnType<typeof createMockAvailabilityRepository>
) {
  let calls = 0;
  return {
    calls: () => calls,
    repository: {
      listOccupyingIntervals: (roomId: string) => {
        calls += 1;
        return base.listOccupyingIntervals(roomId);
      },
    },
  };
}

function repositoryWithReservations(
  roomIds: readonly string[],
  checkIn = "2026-10-05",
  checkOut = "2026-10-08"
) {
  return createMockAvailabilityRepository({
    blocks: [],
    holds: [],
    reservations: roomIds.map((roomId, index) => ({
      checkIn,
      checkOut,
      id: `reservation-${index}`,
      roomId,
      status: "confirmed" as const,
    })),
  });
}

describe("resolveCompanyQuotationAvailability", () => {
  it("rejects invalid dates without querying the availability repository", async () => {
    const { calls, repository } = countingRepository(
      repositoryWithReservations([])
    );

    await expect(
      resolveCompanyQuotationAvailability(
        { checkIn: "no-date", checkOut: "2026-10-08", guestCount: 2 },
        { availabilityRepository: repository, roomSource }
      )
    ).rejects.toBeInstanceOf(CompanyQuotationAvailabilityInputError);
    expect(calls()).toBe(0);
  });

  it("rejects an invalid guest count without querying the availability repository", async () => {
    const { calls, repository } = countingRepository(
      repositoryWithReservations([])
    );

    await expect(
      resolveCompanyQuotationAvailability(
        { checkIn: "2026-10-05", checkOut: "2026-10-08", guestCount: 0 },
        { availabilityRepository: repository, roomSource }
      )
    ).rejects.toBeInstanceOf(CompanyQuotationAvailabilityInputError);
    expect(calls()).toBe(0);
  });

  it("reports total availability grouped by type, ignoring per-room capacity", async () => {
    const result = await resolveCompanyQuotationAvailability(
      { checkIn: "2026-10-05", checkOut: "2026-10-08", guestCount: 5 },
      { availabilityRepository: repositoryWithReservations([]), roomSource }
    );

    expect(result.rooms).toHaveLength(3);
    expect(
      result.rooms.find((room) => room.name === "Habitación Doble")
    ).toEqual(
      expect.objectContaining({ availableUnits: 1, capacity: 2 })
    );
    expect(result.rooms.map((room) => room.name).sort()).toEqual([
      "Habitación Doble",
      "Habitación Individual",
      "Habitación Matrimonial",
    ]);
    expect(result.totalAvailableRooms).toBe(3);
    expect(result.totalAvailableCapacity).toBe(4);
    expect(result.coversGuestCount).toBe(false);
  });

  it("reports partial but sufficient availability when only some rooms are free", async () => {
    const result = await resolveCompanyQuotationAvailability(
      { checkIn: "2026-10-05", checkOut: "2026-10-08", guestCount: 2 },
      {
        availabilityRepository: repositoryWithReservations(["demo-room-valle"]),
        roomSource,
      }
    );

    expect(result.rooms.map((room) => room.name).sort()).toEqual([
      "Habitación Doble",
      "Habitación Matrimonial",
    ]);
    expect(result.totalAvailableRooms).toBe(2);
    expect(result.totalAvailableCapacity).toBe(3);
    expect(result.coversGuestCount).toBe(true);
  });

  it("reports partial but insufficient availability when most rooms are occupied", async () => {
    const result = await resolveCompanyQuotationAvailability(
      { checkIn: "2026-10-05", checkOut: "2026-10-08", guestCount: 3 },
      {
        availabilityRepository: repositoryWithReservations([
          "demo-room-valle",
          "demo-room-terra",
        ]),
        roomSource,
      }
    );

    expect(result.rooms.map((room) => room.name)).toEqual([
      "Habitación Matrimonial",
    ]);
    expect(result.totalAvailableRooms).toBe(1);
    expect(result.totalAvailableCapacity).toBe(1);
    expect(result.coversGuestCount).toBe(false);
  });

  it("reports zero availability when every room is occupied", async () => {
    const result = await resolveCompanyQuotationAvailability(
      { checkIn: "2026-10-05", checkOut: "2026-10-08", guestCount: 1 },
      {
        availabilityRepository: repositoryWithReservations([
          "demo-room-valle",
          "demo-room-andes",
          "demo-room-terra",
        ]),
        roomSource,
      }
    );

    expect(result.rooms).toEqual([]);
    expect(result.totalAvailableRooms).toBe(0);
    expect(result.totalAvailableCapacity).toBe(0);
    expect(result.coversGuestCount).toBe(false);
  });
});
