import { describe, expect, it } from "vitest";

import {
  checkRoomAvailability,
  createLodgingInterval,
  createMockAvailabilityRepository,
  type OccupyingInterval,
} from "@/features/availability";

const ROOM_A = "room-a";
const ROOM_B = "room-b";

describe("createMockAvailabilityRepository + checkRoomAvailability", () => {
  it("reports unavailable when the requested interval overlaps a confirmed reservation", async () => {
    const repository = createMockAvailabilityRepository({
      blocks: [],
      holds: [],
      reservations: [
        {
          checkIn: "2024-05-05",
          checkOut: "2024-05-10",
          id: "reservation-1",
          roomId: ROOM_A,
          status: "confirmed",
        },
      ],
    });

    const occupying = await repository.listOccupyingIntervals(ROOM_A);
    const result = checkRoomAvailability(
      occupying,
      createLodgingInterval("2024-05-06", "2024-05-08")
    );

    expect(result.available).toBe(false);
    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      source: "reservation",
      sourceId: "reservation-1",
    });
  });

  it("reports unavailable when the requested interval overlaps an unexpired hold", async () => {
    const now = () => new Date("2024-05-01T00:00:00.000Z");
    const repository = createMockAvailabilityRepository(
      {
        blocks: [],
        holds: [
          {
            checkIn: "2024-05-05",
            checkOut: "2024-05-10",
            expiresAt: "2024-05-01T00:30:00.000Z",
            id: "hold-1",
            roomId: ROOM_A,
          },
        ],
        reservations: [],
      },
      now
    );

    const occupying = await repository.listOccupyingIntervals(ROOM_A);
    const result = checkRoomAvailability(
      occupying,
      createLodgingInterval("2024-05-06", "2024-05-08")
    );

    expect(result.available).toBe(false);
    expect(result.conflicts).toMatchObject([
      { source: "hold", sourceId: "hold-1" },
    ]);
  });

  it("reports unavailable when the requested interval overlaps an active block", async () => {
    const repository = createMockAvailabilityRepository({
      blocks: [
        {
          checkIn: "2024-05-05",
          checkOut: "2024-05-10",
          id: "block-1",
          removedAt: null,
          roomId: ROOM_A,
        },
      ],
      holds: [],
      reservations: [],
    });

    const occupying = await repository.listOccupyingIntervals(ROOM_A);
    const result = checkRoomAvailability(
      occupying,
      createLodgingInterval("2024-05-06", "2024-05-08")
    );

    expect(result.available).toBe(false);
    expect(result.conflicts).toMatchObject([
      { source: "block", sourceId: "block-1" },
    ]);
  });

  it("does not treat a same-day turnover as a conflict", async () => {
    const repository = createMockAvailabilityRepository({
      blocks: [],
      holds: [],
      reservations: [
        {
          checkIn: "2024-05-01",
          checkOut: "2024-05-05",
          id: "reservation-departing",
          roomId: ROOM_A,
          status: "confirmed",
        },
      ],
    });

    const occupying = await repository.listOccupyingIntervals(ROOM_A);
    const result = checkRoomAvailability(
      occupying,
      createLodgingInterval("2024-05-05", "2024-05-08")
    );

    expect(result).toEqual({ available: true, conflicts: [] });
  });

  it("does not let a cancelled reservation block availability", async () => {
    const repository = createMockAvailabilityRepository({
      blocks: [],
      holds: [],
      reservations: [
        {
          checkIn: "2024-05-05",
          checkOut: "2024-05-10",
          id: "reservation-cancelled",
          roomId: ROOM_A,
          status: "cancelled",
        },
      ],
    });

    const occupying = await repository.listOccupyingIntervals(ROOM_A);
    const result = checkRoomAvailability(
      occupying,
      createLodgingInterval("2024-05-06", "2024-05-08")
    );

    expect(result).toEqual({ available: true, conflicts: [] });
  });

  it("excludes an expired hold but keeps an unexpired one", async () => {
    const now = () => new Date("2024-05-01T12:00:00.000Z");
    const repository = createMockAvailabilityRepository(
      {
        blocks: [],
        holds: [
          {
            checkIn: "2024-05-05",
            checkOut: "2024-05-10",
            expiresAt: "2024-05-01T11:00:00.000Z",
            id: "hold-expired",
            roomId: ROOM_A,
          },
          {
            checkIn: "2024-05-05",
            checkOut: "2024-05-10",
            expiresAt: "2024-05-01T13:00:00.000Z",
            id: "hold-active",
            roomId: ROOM_A,
          },
        ],
        reservations: [],
      },
      now
    );

    const occupying = await repository.listOccupyingIntervals(ROOM_A);
    const result = checkRoomAvailability(
      occupying,
      createLodgingInterval("2024-05-06", "2024-05-08")
    );

    expect(result.available).toBe(false);
    expect(result.conflicts).toMatchObject([
      { source: "hold", sourceId: "hold-active" },
    ]);
  });

  it("excludes a removed block but keeps an active one", async () => {
    const repository = createMockAvailabilityRepository({
      blocks: [
        {
          checkIn: "2024-05-05",
          checkOut: "2024-05-10",
          id: "block-removed",
          removedAt: "2024-04-01T00:00:00.000Z",
          roomId: ROOM_A,
        },
        {
          checkIn: "2024-05-05",
          checkOut: "2024-05-10",
          id: "block-active",
          removedAt: null,
          roomId: ROOM_A,
        },
      ],
      holds: [],
      reservations: [],
    });

    const occupying = await repository.listOccupyingIntervals(ROOM_A);
    const result = checkRoomAvailability(
      occupying,
      createLodgingInterval("2024-05-06", "2024-05-08")
    );

    expect(result.available).toBe(false);
    expect(result.conflicts).toMatchObject([
      { source: "block", sourceId: "block-active" },
    ]);
  });

  it("ignores records that belong to a different room", async () => {
    const repository = createMockAvailabilityRepository({
      blocks: [],
      holds: [],
      reservations: [
        {
          checkIn: "2024-05-05",
          checkOut: "2024-05-10",
          id: "reservation-other-room",
          roomId: ROOM_B,
          status: "confirmed",
        },
      ],
    });

    const occupying = await repository.listOccupyingIntervals(ROOM_A);

    expect(occupying).toEqual([]);
  });

  it("resolves a fully-available interval with no conflicts", () => {
    const noConflicts: readonly OccupyingInterval[] = [];
    const result = checkRoomAvailability(
      noConflicts,
      createLodgingInterval("2024-05-06", "2024-05-08")
    );

    expect(result).toEqual({ available: true, conflicts: [] });
  });
});
