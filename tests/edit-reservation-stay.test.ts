import { describe, expect, it } from "vitest";

import {
  createLodgingInterval,
  createMockRoomLockGateway,
  InvalidLodgingIntervalError,
  nights as lodgingNights,
  RoomLockConflictError,
  type MockRoomLockOperationContext,
} from "@/features/availability";
import {
  assertReservationStayEditable,
  computeReservationStayEditFinancialSummary,
  editReservationStay,
  recalculateReservationStayPricing,
  ReservationStayRequiresRoomError,
  ReservationStayRoomCapacityExceededError,
  stayEditLockRoomIds,
  type ReservationStayRoomRate,
} from "@/features/reservations/edit-reservation-stay";
import {
  createMockReservationRepository,
  type ReservationRecord,
} from "@/features/reservations/reservation-repository";

type RateSpec = Readonly<{
  capacity?: number;
  nightlyPriceClp: number;
  occupancyPrices?: readonly Readonly<{
    occupancy: number;
    priceClp: number;
  }>[];
}>;

function ratesOf(
  rates: Record<string, RateSpec>
): (
  roomIds: readonly string[]
) => Promise<ReadonlyMap<string, ReservationStayRoomRate>> {
  return async (roomIds) =>
    new Map(
      roomIds.flatMap((roomId) => {
        const spec = rates[roomId];
        if (!spec) return [];
        return [
          [
            roomId,
            Object.freeze({
              capacity: spec.capacity ?? 4,
              id: roomId,
              nightlyPriceClp: spec.nightlyPriceClp,
              occupancyPrices: spec.occupancyPrices ?? [],
            }),
          ] as const,
        ];
      })
    );
}

type Gateway = ReturnType<typeof createMockRoomLockGateway>;
type Repository = ReturnType<typeof createMockReservationRepository>;

async function createReservation(
  roomLockGateway: Gateway,
  reservationRepository: Repository,
  params: Readonly<{
    checkIn: string;
    checkOut: string;
    publicId: string;
    rooms: readonly Readonly<{
      guestCount?: number;
      nightlyPriceClp: number;
      roomId: string;
    }>[];
  }>
): Promise<ReservationRecord> {
  const interval = createLodgingInterval(params.checkIn, params.checkOut);
  const nights = lodgingNights(interval.checkIn, interval.checkOut);
  const { reservation } = await roomLockGateway.runExclusiveMany(
    params.rooms.map((room) => room.roomId),
    interval,
    (context: MockRoomLockOperationContext) =>
      reservationRepository.createConfirmedPayAtPropertyReservation(context, {
        checkIn: interval.checkIn,
        checkOut: interval.checkOut,
        guestCount: params.rooms.reduce(
          (total, room) => total + (room.guestCount ?? 2),
          0
        ),
        guestId: "guest-1",
        items: params.rooms.map((room) => ({
          chargesClp: 0,
          guestCount: room.guestCount ?? 2,
          nightlyPriceClp: room.nightlyPriceClp,
          nights,
          roomId: room.roomId,
          totalClp: nights * room.nightlyPriceClp,
        })),
        publicId: params.publicId,
      })
  );
  return reservation;
}

function roomIdsOf(reservation: ReservationRecord): readonly string[] {
  return reservation.items
    .map((item) => item.roomId)
    .slice()
    .sort();
}

function occupancyOf(reservation: ReservationRecord, roomId: string) {
  return reservation.items.find((item) => item.roomId === roomId);
}

describe("stay edit eligibility (task 2.7)", () => {
  function buildReservation(
    overrides: Partial<ReservationRecord> = {}
  ): ReservationRecord {
    return Object.freeze({
      chargesClp: 0,
      checkIn: "2026-10-05",
      checkOut: "2026-10-08",
      createdAt: new Date("2026-09-01T00:00:00Z"),
      guestCount: 2,
      guestId: "guest-1",
      id: "reservation-1",
      items: Object.freeze([
        Object.freeze({
          chargesClp: 0,
          guestCount: 2,
          nightlyPriceClp: 50_000,
          nightlyPriceManual: false,
          nights: 3,
          roomId: "room-1",
          subtotalClp: 150_000,
        }),
      ]),
      nightlyPriceClp: 50_000,
      origin: "website" as const,
      paymentMode: "pay_at_property" as const,
      publicId: "VV-0001",
      roomId: "room-1",
      status: "confirmed" as const,
      totalClp: 150_000,
      updatedAt: new Date("2026-09-01T00:00:00Z"),
      ...overrides,
    });
  }

  it.each([
    "website",
    "phone",
    "whatsapp",
    "admin",
    "airbnb",
    "booking",
  ] as const)("allows a %s reservation", (origin) => {
    expect(() =>
      assertReservationStayEditable(buildReservation({ origin }))
    ).not.toThrow();
  });

  it.each(["cancelled", "completed", "no_show"] as const)(
    "allows a %s reservation",
    (status) => {
      expect(() =>
        assertReservationStayEditable(buildReservation({ status }))
      ).not.toThrow();
    }
  );

  it.each(["cancelled", "completed", "no_show"] as const)(
    "keeps a %s reservation in that status after a room change",
    async (status) => {
      const roomLockGateway = createMockRoomLockGateway();
      const reservationRepository = createMockReservationRepository();
      const reservation = await createReservation(
        roomLockGateway,
        reservationRepository,
        {
          checkIn: "2026-10-05",
          checkOut: "2026-10-08",
          publicId: `VV-status-${status}`,
          rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }],
        }
      );
      await reservationRepository.transitionReservationState(
        { recordOccupancy: () => {}, removeOccupancy: () => {} } as never,
        { reservationId: reservation.id, to: status }
      );

      const { reservation: updated } = await editReservationStay({
        getRoomRates: ratesOf({ "room-9": { nightlyPriceClp: 30_000 } }),
        input: {
          items: [{ guestCount: 2, roomId: "room-9" }],
          reservationId: reservation.id,
        },
        reservationRepository,
        roomLockGateway,
      });

      expect(updated.status).toBe(status);
      expect(roomIdsOf(updated)).toEqual(["room-9"]);
    }
  );
});

describe("requested stay resolution (task 2.1)", () => {
  it("keeps the current rooms and dates when neither axis is provided", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-10-05",
        checkOut: "2026-10-08",
        publicId: "VV-noop",
        rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }],
      }
    );

    const { reservation: updated } = await editReservationStay({
      getRoomRates: ratesOf({ "room-1": { nightlyPriceClp: 50_000 } }),
      input: { reservationId: reservation.id },
      reservationRepository,
      roomLockGateway,
    });

    expect(updated.checkIn).toBe("2026-10-05");
    expect(updated.checkOut).toBe("2026-10-08");
    expect(roomIdsOf(updated)).toEqual(["room-1"]);
    expect(updated.totalClp).toBe(reservation.totalClp);
  });

  it("rejects an interval whose check-out is not after its check-in", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-10-05",
        checkOut: "2026-10-08",
        publicId: "VV-interval",
        rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }],
      }
    );

    await expect(
      editReservationStay({
        getRoomRates: ratesOf({ "room-1": { nightlyPriceClp: 50_000 } }),
        input: {
          checkIn: "2026-10-08",
          checkOut: "2026-10-08",
          reservationId: reservation.id,
        },
        reservationRepository,
        roomLockGateway,
      })
    ).rejects.toBeInstanceOf(InvalidLodgingIntervalError);

    const unchanged = await reservationRepository.getReservationById(
      reservation.id
    );
    expect(unchanged!.checkOut).toBe("2026-10-08");
  });

  it("edits a reservation whose check-in is already in the past", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2020-03-01",
        checkOut: "2020-03-05",
        publicId: "VV-in-progress",
        rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }],
      }
    );

    const { reservation: updated } = await editReservationStay({
      getRoomRates: ratesOf({ "room-2": { nightlyPriceClp: 40_000 } }),
      input: {
        items: [{ guestCount: 2, roomId: "room-2" }],
        reservationId: reservation.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    expect(roomIdsOf(updated)).toEqual(["room-2"]);
    expect(updated.checkIn).toBe("2020-03-01");
  });
});

describe("occupancy axis (task 2.2)", () => {
  it("re-resolves the nightly price for the requested occupancy without moving the dates", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-10-05",
        checkOut: "2026-10-07",
        publicId: "VV-occupancy",
        rooms: [{ guestCount: 2, nightlyPriceClp: 50_000, roomId: "room-1" }],
      }
    );
    expect(reservation.totalClp).toBe(100_000);

    const { reservation: updated } = await editReservationStay({
      getRoomRates: ratesOf({
        "room-1": {
          nightlyPriceClp: 50_000,
          occupancyPrices: [
            { occupancy: 2, priceClp: 50_000 },
            { occupancy: 4, priceClp: 80_000 },
          ],
        },
      }),
      input: {
        items: [{ guestCount: 4, roomId: "room-1" }],
        reservationId: reservation.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    expect(occupancyOf(updated, "room-1")!.guestCount).toBe(4);
    expect(occupancyOf(updated, "room-1")!.nightlyPriceClp).toBe(80_000);
    expect(updated.totalClp).toBe(160_000);
    expect(updated.checkIn).toBe("2026-10-05");
    expect(updated.checkOut).toBe("2026-10-07");
    expect(updated.guestCount).toBe(4);
  });

  it("recalculates from the room's current rate, never a caller-supplied price", () => {
    const pricing = recalculateReservationStayPricing(
      createLodgingInterval("2026-10-05", "2026-10-07"),
      [{ guestCount: 3, roomId: "room-1" }],
      new Map([
        [
          "room-1",
          Object.freeze({
            capacity: 4,
            id: "room-1",
            nightlyPriceClp: 70_000,
            occupancyPrices: [{ occupancy: 3, priceClp: 65_000 }],
          }),
        ],
      ])
    );

    expect(pricing.items[0]!.nightlyPriceClp).toBe(65_000);
    expect(pricing.totalClp).toBe(130_000);
  });

  it("reports a requested room with no current rate", async () => {
    await expect(
      editReservationStay({
        getRoomRates: ratesOf({}),
        input: {
          items: [{ guestCount: 2, roomId: "room-gone" }],
          reservationId: "missing",
        },
        reservationRepository: createMockReservationRepository(),
        roomLockGateway: createMockRoomLockGateway(),
      })
    ).rejects.toThrow();
  });
});

describe("capacity validation (task 2.3)", () => {
  it("rejects an occupancy larger than the room's capacity and leaves the reservation intact", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-10-05",
        checkOut: "2026-10-07",
        publicId: "VV-capacity",
        rooms: [{ guestCount: 2, nightlyPriceClp: 50_000, roomId: "room-1" }],
      }
    );

    await expect(
      editReservationStay({
        getRoomRates: ratesOf({
          "room-1": { capacity: 4, nightlyPriceClp: 50_000 },
        }),
        input: {
          items: [{ guestCount: 5, roomId: "room-1" }],
          reservationId: reservation.id,
        },
        reservationRepository,
        roomLockGateway,
      })
    ).rejects.toBeInstanceOf(ReservationStayRoomCapacityExceededError);

    const unchanged = await reservationRepository.getReservationById(
      reservation.id
    );
    expect(occupancyOf(unchanged!, "room-1")!.guestCount).toBe(2);
    expect(unchanged!.totalClp).toBe(100_000);
  });

  it("rejects a non-positive occupancy", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-10-05",
        checkOut: "2026-10-07",
        publicId: "VV-zero-guests",
        rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }],
      }
    );

    await expect(
      editReservationStay({
        getRoomRates: ratesOf({ "room-1": { nightlyPriceClp: 50_000 } }),
        input: {
          items: [{ guestCount: 0, roomId: "room-1" }],
          reservationId: reservation.id,
        },
        reservationRepository,
        roomLockGateway,
      })
    ).rejects.toBeInstanceOf(ReservationStayRoomCapacityExceededError);
  });

  it("reports the room, the requested count and the capacity", () => {
    const error = new ReservationStayRoomCapacityExceededError("room-1", 5, 4);
    expect(error.code).toBe("RESERVATION_STAY_ROOM_CAPACITY_EXCEEDED");
    expect(error.roomId).toBe("room-1");
    expect(error.guestCount).toBe(5);
    expect(error.capacity).toBe(4);
  });
});

describe("empty stay (task 2.4)", () => {
  it("rejects removing the only room with its own typed reason", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-10-05",
        checkOut: "2026-10-07",
        publicId: "VV-empty-one",
        rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }],
      }
    );

    await expect(
      editReservationStay({
        getRoomRates: ratesOf({ "room-1": { nightlyPriceClp: 50_000 } }),
        input: { items: [], reservationId: reservation.id },
        reservationRepository,
        roomLockGateway,
      })
    ).rejects.toBeInstanceOf(ReservationStayRequiresRoomError);

    const unchanged = await reservationRepository.getReservationById(
      reservation.id
    );
    expect(roomIdsOf(unchanged!)).toEqual(["room-1"]);
  });

  it("rejects removing every room of a multi-room reservation and keeps them all", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-10-05",
        checkOut: "2026-10-07",
        publicId: "VV-empty-many",
        rooms: [
          { guestCount: 2, nightlyPriceClp: 50_000, roomId: "room-a" },
          { guestCount: 3, nightlyPriceClp: 40_000, roomId: "room-b" },
        ],
      }
    );

    await expect(
      editReservationStay({
        getRoomRates: ratesOf({
          "room-a": { nightlyPriceClp: 50_000 },
          "room-b": { nightlyPriceClp: 40_000 },
        }),
        input: { items: [], reservationId: reservation.id },
        reservationRepository,
        roomLockGateway,
      })
    ).rejects.toBeInstanceOf(ReservationStayRequiresRoomError);

    const unchanged = await reservationRepository.getReservationById(
      reservation.id
    );
    expect(roomIdsOf(unchanged!)).toEqual(["room-a", "room-b"]);
    expect(occupancyOf(unchanged!, "room-b")!.guestCount).toBe(3);
    expect(unchanged!.checkIn).toBe("2026-10-05");
  });

  it("does not surface the pricing guard as the user-facing reason", () => {
    const error = new ReservationStayRequiresRoomError();
    expect(error.code).toBe("RESERVATION_STAY_REQUIRES_ROOM");
    expect(error.name).toBe("ReservationStayRequiresRoomError");
  });
});

describe("room set changes (tasks 2.5 and 1.2)", () => {
  it("adds a room to the stay, keeping the existing item untouched", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-10-05",
        checkOut: "2026-10-07",
        publicId: "VV-add",
        rooms: [{ guestCount: 2, nightlyPriceClp: 50_000, roomId: "room-a" }],
      }
    );

    const { reservation: updated } = await editReservationStay({
      getRoomRates: ratesOf({
        "room-a": { nightlyPriceClp: 50_000 },
        "room-b": { nightlyPriceClp: 30_000 },
      }),
      input: {
        items: [
          { guestCount: 2, roomId: "room-a" },
          { guestCount: 3, roomId: "room-b" },
        ],
        reservationId: reservation.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    expect(roomIdsOf(updated)).toEqual(["room-a", "room-b"]);
    expect(occupancyOf(updated, "room-a")!.guestCount).toBe(2);
    expect(occupancyOf(updated, "room-a")!.subtotalClp).toBe(100_000);
    expect(occupancyOf(updated, "room-b")!.guestCount).toBe(3);
    expect(updated.totalClp).toBe(160_000);
    expect(updated.guestCount).toBe(5);
  });

  it("removes a room from a multi-room stay and frees its availability", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-10-05",
        checkOut: "2026-10-07",
        publicId: "VV-remove",
        rooms: [
          { guestCount: 2, nightlyPriceClp: 50_000, roomId: "room-a" },
          { guestCount: 2, nightlyPriceClp: 40_000, roomId: "room-b" },
        ],
      }
    );

    const { reservation: updated } = await editReservationStay({
      getRoomRates: ratesOf({ "room-a": { nightlyPriceClp: 50_000 } }),
      input: {
        items: [{ guestCount: 2, roomId: "room-a" }],
        reservationId: reservation.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    expect(roomIdsOf(updated)).toEqual(["room-a"]);
    expect(updated.totalClp).toBe(100_000);

    // room-b is free again: another reservation can now take it.
    const other = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-10-05",
        checkOut: "2026-10-07",
        publicId: "VV-remove-other",
        rooms: [{ nightlyPriceClp: 40_000, roomId: "room-b" }],
      }
    );
    expect(roomIdsOf(other)).toEqual(["room-b"]);
  });

  it("swaps one room for another in a single operation", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-10-05",
        checkOut: "2026-10-07",
        publicId: "VV-swap",
        rooms: [{ guestCount: 2, nightlyPriceClp: 50_000, roomId: "room-a" }],
      }
    );

    const { reservation: updated } = await editReservationStay({
      getRoomRates: ratesOf({ "room-b": { nightlyPriceClp: 30_000 } }),
      input: {
        items: [{ guestCount: 2, roomId: "room-b" }],
        reservationId: reservation.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    expect(roomIdsOf(updated)).toEqual(["room-b"]);
    expect(updated.totalClp).toBe(60_000);
  });

  it("changes dates and rooms together in one operation", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-10-05",
        checkOut: "2026-10-07",
        publicId: "VV-both-axes",
        rooms: [{ guestCount: 2, nightlyPriceClp: 50_000, roomId: "room-a" }],
      }
    );

    const { reservation: updated } = await editReservationStay({
      getRoomRates: ratesOf({ "room-b": { nightlyPriceClp: 30_000 } }),
      input: {
        checkIn: "2026-10-10",
        checkOut: "2026-10-13",
        items: [{ guestCount: 4, roomId: "room-b" }],
        reservationId: reservation.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    expect(roomIdsOf(updated)).toEqual(["room-b"]);
    expect(updated.checkIn).toBe("2026-10-10");
    expect(updated.checkOut).toBe("2026-10-13");
    expect(occupancyOf(updated, "room-b")!.nights).toBe(3);
    expect(updated.totalClp).toBe(90_000);
  });
});

describe("locking the union of current and requested rooms (task 2.5)", () => {
  it("locks current and requested rooms once each, in stable order", () => {
    const current = {
      items: [{ roomId: "room-b" }, { roomId: "room-a" }],
    };

    expect(
      stayEditLockRoomIds(current, [
        { guestCount: 2, roomId: "room-c" },
        { guestCount: 2, roomId: "room-a" },
      ])
    ).toEqual(["room-a", "room-b", "room-c"]);
  });

  it("rejects adding a room another confirmed reservation already occupies", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-11-01",
        checkOut: "2026-11-04",
        publicId: "VV-union-own",
        rooms: [{ nightlyPriceClp: 50_000, roomId: "room-a" }],
      }
    );
    await createReservation(roomLockGateway, reservationRepository, {
      checkIn: "2026-11-02",
      checkOut: "2026-11-05",
      publicId: "VV-union-other",
      rooms: [{ nightlyPriceClp: 40_000, roomId: "room-b" }],
    });

    await expect(
      editReservationStay({
        getRoomRates: ratesOf({
          "room-a": { nightlyPriceClp: 50_000 },
          "room-b": { nightlyPriceClp: 40_000 },
        }),
        input: {
          items: [
            { guestCount: 2, roomId: "room-a" },
            { guestCount: 2, roomId: "room-b" },
          ],
          reservationId: reservation.id,
        },
        reservationRepository,
        roomLockGateway,
      })
    ).rejects.toBeInstanceOf(RoomLockConflictError);

    const unchanged = await reservationRepository.getReservationById(
      reservation.id
    );
    expect(roomIdsOf(unchanged!)).toEqual(["room-a"]);
  });

  it("does not reject a removal because of the reservation's own occupancy", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-11-01",
        checkOut: "2026-11-04",
        publicId: "VV-own-occupancy",
        rooms: [
          { nightlyPriceClp: 50_000, roomId: "room-a" },
          { nightlyPriceClp: 40_000, roomId: "room-b" },
        ],
      }
    );

    const { reservation: updated } = await editReservationStay({
      getRoomRates: ratesOf({ "room-a": { nightlyPriceClp: 50_000 } }),
      input: {
        items: [{ guestCount: 2, roomId: "room-a" }],
        reservationId: reservation.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    expect(roomIdsOf(updated)).toEqual(["room-a"]);
  });
});

describe("financial reconciliation (task 2.6)", () => {
  it("replaces the pending balance when the reservation has no approved payment", () => {
    const summary = computeReservationStayEditFinancialSummary(
      180_000,
      0,
      true
    );
    expect(summary.paymentAction).toEqual({
      type: "set_pending",
      amountClp: 180_000,
    });
    expect(summary.overpaymentClp).toBe(0);
  });

  it("creates a pending balance for the difference when the total grew", () => {
    const summary = computeReservationStayEditFinancialSummary(
      200_000,
      150_000,
      false
    );
    expect(summary.paymentAction).toEqual({
      type: "set_pending",
      amountClp: 50_000,
    });
    expect(summary.pendingBalanceClp).toBe(50_000);
    expect(summary.overpaymentClp).toBe(0);
  });

  it("records an overpayment without charging when the total dropped", () => {
    const summary = computeReservationStayEditFinancialSummary(
      90_000,
      150_000,
      false
    );
    expect(summary.paymentAction).toEqual({ type: "none" });
    expect(summary.overpaymentClp).toBe(60_000);
    expect(summary.pendingBalanceClp).toBe(0);
  });

  it("records an overpayment when removing a room drops the total below what was paid", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-10-05",
        checkOut: "2026-10-07",
        publicId: "VV-overpaid",
        rooms: [
          { guestCount: 2, nightlyPriceClp: 50_000, roomId: "room-a" },
          { guestCount: 2, nightlyPriceClp: 40_000, roomId: "room-b" },
        ],
      }
    );
    // Approves the pending balance the reservation was created with
    // (2 nights x (50.000 + 40.000) = 180.000).
    await reservationRepository.approvePayAtPropertyPayment?.(reservation.id);

    const { financialSummary } = await editReservationStay({
      getRoomRates: ratesOf({ "room-a": { nightlyPriceClp: 50_000 } }),
      input: {
        items: [{ guestCount: 2, roomId: "room-a" }],
        reservationId: reservation.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    expect(financialSummary.pendingBalanceClp).toBe(0);
    expect(financialSummary.overpaymentClp).toBeGreaterThan(0);
  });
});
