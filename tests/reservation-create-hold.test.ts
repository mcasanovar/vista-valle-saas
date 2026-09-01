import { describe, expect, it } from "vitest";

import {
  createLodgingInterval,
  createMockRoomLockGateway,
  RoomLockConflictError,
  type MockRoomLockOperationContext,
} from "@/features/availability";
import {
  createMockGuestRepository,
  createMockHoldRepository,
  createPaymentHold,
  GuestCapacityExceededError,
  InvalidGuestInputError,
  isHoldExpired,
} from "@/features/reservations";

const ROOM = Object.freeze({
  capacity: 2,
  id: "room-a",
  nightlyPriceClp: 60_000,
});

const validGuestCandidate = Object.freeze({
  email: "ana@example.com",
  firstName: "Ana",
  guestCount: 2,
  lastName: "Perez",
  phone: "+56 9 1234 5678",
});

function delay(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function setUp(now: () => Date = () => new Date("2024-05-01T00:00:00.000Z")) {
  const roomLockGateway = createMockRoomLockGateway(
    { blocks: [], holds: [], reservations: [] },
    now
  );
  const guestRepository =
    createMockGuestRepository<MockRoomLockOperationContext>();
  const holdRepository = createMockHoldRepository();

  return { guestRepository, holdRepository, roomLockGateway };
}

describe("createPaymentHold", () => {
  it("creates a hold with frozen authoritative pricing, a persisted guest, and the correct expiresAt", async () => {
    const now = () => new Date("2024-05-01T00:00:00.000Z");
    const { guestRepository, holdRepository, roomLockGateway } = setUp(now);
    const interval = createLodgingInterval("2024-05-05", "2024-05-08");

    const hold = await createPaymentHold({
      guestCandidate: validGuestCandidate,
      guestRepository,
      holdDurationMinutes: 15,
      holdRepository,
      interval,
      now,
      room: ROOM,
      roomLockGateway,
    });

    expect(hold.roomId).toBe(ROOM.id);
    expect(hold.guestCount).toBe(2);
    expect(hold.nightlyPriceClp).toBe(60_000);
    expect(hold.chargesClp).toBe(0);
    expect(hold.totalClp).toBe(3 * 60_000);
    expect(hold.checkIn).toBe("2024-05-05");
    expect(hold.checkOut).toBe("2024-05-08");
    expect(hold.expiresAt).toEqual(new Date("2024-05-01T00:15:00.000Z"));
    expect(typeof hold.guestId).toBe("string");
    expect(hold.guestId.length).toBeGreaterThan(0);
    expect(Object.isFrozen(hold)).toBe(true);

    const persisted = await holdRepository.getHoldById(hold.id);
    expect(persisted).toEqual(hold);
  });

  it("applies extra charges to the frozen total", async () => {
    const { guestRepository, holdRepository, roomLockGateway } = setUp();
    const interval = createLodgingInterval("2024-05-05", "2024-05-08");

    const hold = await createPaymentHold({
      charges: [{ amountClp: 10_000, label: "Cleaning fee" }],
      guestCandidate: validGuestCandidate,
      guestRepository,
      holdDurationMinutes: 15,
      holdRepository,
      interval,
      room: ROOM,
      roomLockGateway,
    });

    expect(hold.chargesClp).toBe(10_000);
    expect(hold.totalClp).toBe(3 * 60_000 + 10_000);
  });

  it("rejects invalid guest input before touching the lock or repositories", async () => {
    const { guestRepository, holdRepository, roomLockGateway } = setUp();
    const interval = createLodgingInterval("2024-05-05", "2024-05-08");
    let guestRepositoryCalls = 0;
    let holdRepositoryCalls = 0;

    const spiedGuestRepository = Object.freeze({
      createGuest: (
        ...args: Parameters<typeof guestRepository.createGuest>
      ) => {
        guestRepositoryCalls += 1;
        return guestRepository.createGuest(...args);
      },
    });
    const spiedHoldRepository = Object.freeze({
      ...holdRepository,
      createHold: (...args: Parameters<typeof holdRepository.createHold>) => {
        holdRepositoryCalls += 1;
        return holdRepository.createHold(...args);
      },
    });

    await expect(
      createPaymentHold({
        guestCandidate: { ...validGuestCandidate, firstName: "" },
        guestRepository: spiedGuestRepository,
        holdDurationMinutes: 15,
        holdRepository: spiedHoldRepository,
        interval,
        room: ROOM,
        roomLockGateway,
      })
    ).rejects.toBeInstanceOf(InvalidGuestInputError);

    expect(guestRepositoryCalls).toBe(0);
    expect(holdRepositoryCalls).toBe(0);
  });

  it("rejects a guest count above the room capacity before touching the lock or repositories", async () => {
    const { guestRepository, holdRepository, roomLockGateway } = setUp();
    const interval = createLodgingInterval("2024-05-05", "2024-05-08");
    let guestRepositoryCalls = 0;

    const spiedGuestRepository = Object.freeze({
      createGuest: (
        ...args: Parameters<typeof guestRepository.createGuest>
      ) => {
        guestRepositoryCalls += 1;
        return guestRepository.createGuest(...args);
      },
    });

    await expect(
      createPaymentHold({
        guestCandidate: { ...validGuestCandidate, guestCount: 3 },
        guestRepository: spiedGuestRepository,
        holdDurationMinutes: 15,
        holdRepository,
        interval,
        room: ROOM,
        roomLockGateway,
      })
    ).rejects.toBeInstanceOf(GuestCapacityExceededError);

    expect(guestRepositoryCalls).toBe(0);
  });

  it("serializes two concurrent overlapping hold attempts for the same room so exactly one succeeds", async () => {
    const { guestRepository, holdRepository, roomLockGateway } = setUp();
    const interval = createLodgingInterval("2024-07-01", "2024-07-05");

    // The mock hold repository registers occupancy synchronously once it
    // runs, so a small delay is injected via a wrapping guest repository
    // to simulate real work happening before the hold is actually
    // persisted (mirroring tests/availability-room-lock.test.ts).
    const delayedGuestRepository = Object.freeze({
      createGuest: async (
        ...args: Parameters<typeof guestRepository.createGuest>
      ) => {
        await delay(10);
        return guestRepository.createGuest(...args);
      },
    });

    const attempt = () =>
      createPaymentHold({
        guestCandidate: validGuestCandidate,
        guestRepository: delayedGuestRepository,
        holdDurationMinutes: 15,
        holdRepository,
        interval,
        room: ROOM,
        roomLockGateway,
      });

    const [first, second] = await Promise.allSettled([attempt(), attempt()]);

    const settledStatuses = [first.status, second.status].sort();
    expect(settledStatuses).toEqual(["fulfilled", "rejected"]);

    const rejected = first.status === "rejected" ? first : second;
    if (rejected.status === "rejected") {
      expect(rejected.reason).toBeInstanceOf(RoomLockConflictError);
    }
  });

  it("allows a new overlapping hold once the previous hold has expired (checkout abandonado), reusing the same gateway", async () => {
    let current = new Date("2024-05-01T00:00:00.000Z");
    const now = () => current;
    const interval = createLodgingInterval("2024-05-05", "2024-05-08");
    const guestRepository =
      createMockGuestRepository<MockRoomLockOperationContext>();
    const holdRepository = createMockHoldRepository();

    // A single, long-lived gateway/hold-repository pair, exactly as a
    // real long-running process (e.g. a dev server or the production
    // singleton) would keep reusing them across real time, instead of
    // constructing a fresh gateway per request. This is what the
    // production Drizzle-backed adapter
    // (`src/infrastructure/database/room-lock.ts`) does implicitly by
    // re-querying `reservation_holds` live on every call: the mock must
    // match that behavior instead of only filtering expiry once at seed
    // time (see `src/features/availability/room-lock.ts`).
    const roomLockGateway = createMockRoomLockGateway(
      { blocks: [], holds: [], reservations: [] },
      now
    );

    const firstHold = await createPaymentHold({
      guestCandidate: validGuestCandidate,
      guestRepository,
      holdDurationMinutes: 5,
      holdRepository,
      interval,
      now,
      room: ROOM,
      roomLockGateway,
    });

    expect(isHoldExpired(firstHold, now)).toBe(false);

    // The still-unexpired hold must keep blocking an overlapping request
    // on this same gateway instance.
    await expect(
      createPaymentHold({
        guestCandidate: validGuestCandidate,
        guestRepository,
        holdDurationMinutes: 5,
        holdRepository,
        interval,
        now,
        room: ROOM,
        roomLockGateway,
      })
    ).rejects.toBeInstanceOf(RoomLockConflictError);

    // Advance the clock past the first hold's expiry without any
    // administrative intervention.
    current = new Date(firstHold.expiresAt.getTime() + 1);

    expect(isHoldExpired(firstHold, now)).toBe(true);

    // No second gateway, no re-seeding: the same long-lived gateway must
    // re-derive live expiry on this call and see the room as available
    // again, per the "Vencimiento de retenciones" spec requirement.
    const secondHold = await createPaymentHold({
      guestCandidate: validGuestCandidate,
      guestRepository,
      holdDurationMinutes: 5,
      holdRepository,
      interval,
      now,
      room: ROOM,
      roomLockGateway,
    });

    expect(secondHold.id).not.toBe(firstHold.id);
    expect(secondHold.roomId).toBe(ROOM.id);
  });

  it("propagates RoomLockConflictError without swallowing it when the room is unavailable", async () => {
    const { guestRepository, holdRepository, roomLockGateway } = setUp();
    const interval = createLodgingInterval("2024-06-01", "2024-06-05");

    await createPaymentHold({
      guestCandidate: validGuestCandidate,
      guestRepository,
      holdDurationMinutes: 15,
      holdRepository,
      interval,
      room: ROOM,
      roomLockGateway,
    });

    await expect(
      createPaymentHold({
        guestCandidate: validGuestCandidate,
        guestRepository,
        holdDurationMinutes: 15,
        holdRepository,
        interval: createLodgingInterval("2024-06-02", "2024-06-03"),
        room: ROOM,
        roomLockGateway,
      })
    ).rejects.toBeInstanceOf(RoomLockConflictError);
  });
});

describe("getHoldById", () => {
  it("returns null for an unknown id", async () => {
    const { holdRepository } = setUp();

    await expect(
      holdRepository.getHoldById("does-not-exist")
    ).resolves.toBeNull();
  });
});

describe("isHoldExpired", () => {
  it("returns false strictly before expiresAt and true at or after it", () => {
    const hold = { expiresAt: new Date("2024-05-01T00:15:00.000Z") };

    expect(
      isHoldExpired(hold, () => new Date("2024-05-01T00:14:59.999Z"))
    ).toBe(false);
    expect(
      isHoldExpired(hold, () => new Date("2024-05-01T00:15:00.000Z"))
    ).toBe(true);
    expect(
      isHoldExpired(hold, () => new Date("2024-05-01T00:15:00.001Z"))
    ).toBe(true);
  });
});
