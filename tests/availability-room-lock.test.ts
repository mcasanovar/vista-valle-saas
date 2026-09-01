import { describe, expect, it } from "vitest";

import {
  createLodgingInterval,
  createMockRoomLockGateway,
  RoomLockConflictError,
} from "@/features/availability";

const ROOM_A = "room-a";
const ROOM_B = "room-b";

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

describe("createMockRoomLockGateway", () => {
  it("calls operation and returns its result when the interval is available", async () => {
    const gateway = createMockRoomLockGateway();

    const result = await gateway.runExclusive(
      ROOM_A,
      createLodgingInterval("2024-05-05", "2024-05-10"),
      async (context) => {
        context.recordOccupancy({
          interval: createLodgingInterval("2024-05-05", "2024-05-10"),
          source: "reservation",
          sourceId: "reservation-1",
        });
        return "created";
      }
    );

    expect(result).toBe("created");
  });

  it("rejects a subsequent overlapping call for the same room once occupancy is registered", async () => {
    const gateway = createMockRoomLockGateway();

    await gateway.runExclusive(
      ROOM_A,
      createLodgingInterval("2024-05-05", "2024-05-10"),
      async (context) => {
        context.recordOccupancy({
          interval: createLodgingInterval("2024-05-05", "2024-05-10"),
          source: "reservation",
          sourceId: "reservation-1",
        });
      }
    );

    const secondCall = gateway.runExclusive(
      ROOM_A,
      createLodgingInterval("2024-05-06", "2024-05-08"),
      async () => "should not run"
    );

    await expect(secondCall).rejects.toBeInstanceOf(RoomLockConflictError);
    await expect(secondCall).rejects.toMatchObject({
      code: "ROOM_LOCK_CONFLICT",
      conflicts: [{ source: "reservation", sourceId: "reservation-1" }],
    });
  });

  it("does not report a false conflict for a non-overlapping interval, including same-day turnover", async () => {
    const gateway = createMockRoomLockGateway();

    await gateway.runExclusive(
      ROOM_A,
      createLodgingInterval("2024-05-01", "2024-05-05"),
      async (context) => {
        context.recordOccupancy({
          interval: createLodgingInterval("2024-05-01", "2024-05-05"),
          source: "reservation",
          sourceId: "reservation-1",
        });
      }
    );

    // Same-day turnover: the new interval starts exactly when the first
    // one ends, so it must not be treated as a conflict.
    const result = await gateway.runExclusive(
      ROOM_A,
      createLodgingInterval("2024-05-05", "2024-05-08"),
      async (context) => {
        context.recordOccupancy({
          interval: createLodgingInterval("2024-05-05", "2024-05-08"),
          source: "reservation",
          sourceId: "reservation-2",
        });
        return "created-second";
      }
    );

    expect(result).toBe("created-second");
  });

  it("does not let different rooms block each other", async () => {
    const gateway = createMockRoomLockGateway();
    const completionOrder: string[] = [];

    const [resultA, resultB] = await Promise.all([
      gateway.runExclusive(
        ROOM_A,
        createLodgingInterval("2024-06-01", "2024-06-05"),
        async (context) => {
          await delay(30);
          context.recordOccupancy({
            interval: createLodgingInterval("2024-06-01", "2024-06-05"),
            source: "reservation",
            sourceId: "reservation-room-a",
          });
          completionOrder.push("room-a");
          return "room-a-created";
        }
      ),
      gateway.runExclusive(
        ROOM_B,
        createLodgingInterval("2024-06-01", "2024-06-05"),
        async (context) => {
          context.recordOccupancy({
            interval: createLodgingInterval("2024-06-01", "2024-06-05"),
            source: "reservation",
            sourceId: "reservation-room-b",
          });
          completionOrder.push("room-b");
          return "room-b-created";
        }
      ),
    ]);

    expect(resultA).toBe("room-a-created");
    expect(resultB).toBe("room-b-created");
    // Room B has no artificial delay, so it must complete first: room A's
    // in-flight, slower operation must not block room B's lock.
    expect(completionOrder).toEqual(["room-b", "room-a"]);
  });

  it("serializes two concurrent overlapping requests for the same room so exactly one succeeds", async () => {
    const gateway = createMockRoomLockGateway();
    const requestedInterval = createLodgingInterval("2024-07-01", "2024-07-05");

    const attempt = (sourceId: string) =>
      gateway.runExclusive(ROOM_A, requestedInterval, async (context) => {
        // Simulate work happening before occupancy is registered, so a
        // naive "check then act" implementation without real locking
        // would let both attempts pass the check before either commits.
        await delay(10);
        context.recordOccupancy({
          interval: requestedInterval,
          source: "reservation",
          sourceId,
        });
        return sourceId;
      });

    const [first, second] = await Promise.allSettled([
      attempt("reservation-first"),
      attempt("reservation-second"),
    ]);

    const settledStatuses = [first.status, second.status].sort();
    expect(settledStatuses).toEqual(["fulfilled", "rejected"]);

    const rejected = first.status === "rejected" ? first : second;
    expect(rejected.status).toBe("rejected");
    if (rejected.status === "rejected") {
      expect(rejected.reason).toBeInstanceOf(RoomLockConflictError);
      expect((rejected.reason as RoomLockConflictError).conflicts).toHaveLength(
        1
      );
    }
  });

  it("seeds initial occupancy from existing reservations, holds, and blocks", async () => {
    const now = () => new Date("2024-05-01T00:00:00.000Z");
    const gateway = createMockRoomLockGateway(
      {
        blocks: [],
        holds: [
          {
            checkIn: "2024-05-05",
            checkOut: "2024-05-10",
            expiresAt: "2024-05-01T01:00:00.000Z",
            id: "hold-1",
            roomId: ROOM_A,
          },
        ],
        reservations: [],
      },
      now
    );

    const attempt = gateway.runExclusive(
      ROOM_A,
      createLodgingInterval("2024-05-06", "2024-05-08"),
      async () => "should not run"
    );

    await expect(attempt).rejects.toBeInstanceOf(RoomLockConflictError);
    await expect(attempt).rejects.toMatchObject({
      conflicts: [{ source: "hold", sourceId: "hold-1" }],
    });
  });

  it("re-derives live expiry for a hold recorded via recordOccupancy on every call, without a second gateway instance", async () => {
    let current = new Date("2024-05-01T00:00:00.000Z");
    const now = () => current;
    const gateway = createMockRoomLockGateway(
      { blocks: [], holds: [], reservations: [] },
      now
    );
    const holdExpiresAt = new Date("2024-05-01T00:15:00.000Z");

    await gateway.runExclusive(
      ROOM_A,
      createLodgingInterval("2024-05-05", "2024-05-08"),
      async (context) => {
        context.recordOccupancy({
          expiresAt: holdExpiresAt,
          interval: createLodgingInterval("2024-05-05", "2024-05-08"),
          source: "hold",
          sourceId: "hold-1",
        });
      }
    );

    // Still within the hold's lifetime: an overlapping request must be
    // rejected.
    const stillBlocked = gateway.runExclusive(
      ROOM_A,
      createLodgingInterval("2024-05-06", "2024-05-07"),
      async () => "should not run"
    );
    await expect(stillBlocked).rejects.toBeInstanceOf(RoomLockConflictError);
    await expect(stillBlocked).rejects.toMatchObject({
      conflicts: [{ source: "hold", sourceId: "hold-1" }],
    });

    // Advance the clock past the hold's expiry without any
    // administrative intervention or new gateway instance.
    current = new Date(holdExpiresAt.getTime() + 1);

    const result = await gateway.runExclusive(
      ROOM_A,
      createLodgingInterval("2024-05-06", "2024-05-07"),
      async (context) => {
        context.recordOccupancy({
          interval: createLodgingInterval("2024-05-06", "2024-05-07"),
          source: "reservation",
          sourceId: "reservation-after-expiry",
        });
        return "created-after-expiry";
      }
    );

    expect(result).toBe("created-after-expiry");
  });

  it("re-derives live expiry for a seeded hold on every call, without a second gateway instance", async () => {
    let current = new Date("2024-05-01T00:00:00.000Z");
    const now = () => current;
    const gateway = createMockRoomLockGateway(
      {
        blocks: [],
        holds: [
          {
            checkIn: "2024-05-05",
            checkOut: "2024-05-10",
            expiresAt: "2024-05-01T00:15:00.000Z",
            id: "hold-seeded",
            roomId: ROOM_A,
          },
        ],
        reservations: [],
      },
      now
    );

    const stillBlocked = gateway.runExclusive(
      ROOM_A,
      createLodgingInterval("2024-05-06", "2024-05-08"),
      async () => "should not run"
    );
    await expect(stillBlocked).rejects.toBeInstanceOf(RoomLockConflictError);

    // Advance the clock past the seeded hold's expiry: the same gateway
    // instance (no re-seeding) must now allow the overlapping request.
    current = new Date("2024-05-01T00:15:00.001Z");

    const result = await gateway.runExclusive(
      ROOM_A,
      createLodgingInterval("2024-05-06", "2024-05-08"),
      async () => "created-after-seeded-hold-expired"
    );

    expect(result).toBe("created-after-seeded-hold-expired");
  });

  it("never calls operation when the interval is unavailable", async () => {
    const gateway = createMockRoomLockGateway();
    let operationCalls = 0;

    await gateway.runExclusive(
      ROOM_A,
      createLodgingInterval("2024-08-01", "2024-08-05"),
      async (context) => {
        operationCalls += 1;
        context.recordOccupancy({
          interval: createLodgingInterval("2024-08-01", "2024-08-05"),
          source: "reservation",
          sourceId: "reservation-1",
        });
      }
    );

    await expect(
      gateway.runExclusive(
        ROOM_A,
        createLodgingInterval("2024-08-02", "2024-08-03"),
        async (context) => {
          operationCalls += 1;
          context.recordOccupancy({
            interval: createLodgingInterval("2024-08-02", "2024-08-03"),
            source: "reservation",
            sourceId: "reservation-2",
          });
        }
      )
    ).rejects.toBeInstanceOf(RoomLockConflictError);

    expect(operationCalls).toBe(1);
  });
});
