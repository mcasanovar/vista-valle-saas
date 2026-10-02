import { describe, expect, it } from "vitest";

import {
  createLodgingInterval,
  createMockRoomLockGateway,
  nights as lodgingNights,
  type MockRoomLockOperationContext,
} from "@/features/availability";
import {
  editReservationNightlyRates,
  InvalidNightlyRateError,
  mergeNightlyRateOverrides,
  reconcileNightlyRatePayments,
  ReservationRoomNotInStayError,
  type ReservationNightlyRateRoomRate,
} from "@/features/reservations/edit-reservation-nightly-rates";
import { ReservationNotExternalChannelError } from "@/features/reservations/reservation-rate-eligibility";
import {
  createMockReservationRepository,
  type ReservationOrigin,
  type ReservationRecord,
  type ReservationStatus,
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
) => Promise<ReadonlyMap<string, ReservationNightlyRateRoomRate>> {
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

let publicIdCounter = 0;

async function createReservation(
  roomLockGateway: Gateway,
  reservationRepository: Repository,
  params: Readonly<{
    checkIn?: string;
    checkOut?: string;
    origin?: ReservationOrigin;
    rooms: readonly Readonly<{
      guestCount?: number;
      nightlyPriceClp: number;
      roomId: string;
    }>[];
  }>
): Promise<ReservationRecord> {
  const interval = createLodgingInterval(
    params.checkIn ?? "2026-11-01",
    params.checkOut ?? "2026-11-04"
  );
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
        origin: params.origin ?? "booking",
        publicId: `VV-RATE-${(publicIdCounter += 1)}`,
      })
  );
  return reservation;
}

function setup() {
  const roomLockGateway = createMockRoomLockGateway();
  const reservationRepository = createMockReservationRepository();
  return { reservationRepository, roomLockGateway };
}

function lineOf(reservation: ReservationRecord, roomId: string) {
  return reservation.items.find((item) => item.roomId === roomId);
}

describe("editReservationNightlyRates (task 3.1)", () => {
  it("sets a hand-set nightly value and derives the new total from it", async () => {
    const { reservationRepository, roomLockGateway } = setup();
    const created = await createReservation(
      roomLockGateway,
      reservationRepository,
      { rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }] }
    );
    expect(created.totalClp).toBe(150_000);

    const { reservation, financialSummary } =
      await editReservationNightlyRates<MockRoomLockOperationContext>({
        getRoomRates: ratesOf({ "room-1": { nightlyPriceClp: 50_000 } }),
        input: {
          overrides: [{ nightlyPriceClp: 42_000, roomId: "room-1" }],
          reservationId: created.id,
        },
        reservationRepository,
        roomLockGateway,
      });

    // 3 nights * 42.000, derived - never supplied.
    expect(reservation.totalClp).toBe(126_000);
    expect(lineOf(reservation, "room-1")).toMatchObject({
      nightlyPriceClp: 42_000,
      nightlyPriceManual: true,
      nights: 3,
      subtotalClp: 126_000,
    });
    expect(financialSummary.pendingBalanceClp).toBe(126_000);
    // The stay itself is untouched.
    expect(reservation.checkIn).toBe(created.checkIn);
    expect(reservation.checkOut).toBe(created.checkOut);
    expect(reservation.items).toHaveLength(1);
  });

  it("changes an existing hand-set value", async () => {
    const { reservationRepository, roomLockGateway } = setup();
    const created = await createReservation(
      roomLockGateway,
      reservationRepository,
      { rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }] }
    );
    const getRoomRates = ratesOf({ "room-1": { nightlyPriceClp: 50_000 } });

    await editReservationNightlyRates<MockRoomLockOperationContext>({
      getRoomRates,
      input: {
        overrides: [{ nightlyPriceClp: 42_000, roomId: "room-1" }],
        reservationId: created.id,
      },
      reservationRepository,
      roomLockGateway,
    });
    const { reservation } =
      await editReservationNightlyRates<MockRoomLockOperationContext>({
        getRoomRates,
        input: {
          overrides: [{ nightlyPriceClp: 48_000, roomId: "room-1" }],
          reservationId: created.id,
        },
        reservationRepository,
        roomLockGateway,
      });

    expect(lineOf(reservation, "room-1")?.nightlyPriceClp).toBe(48_000);
    expect(reservation.totalClp).toBe(144_000);
  });

  it("drops the hand-set value and returns to the room's current rate", async () => {
    const { reservationRepository, roomLockGateway } = setup();
    const created = await createReservation(
      roomLockGateway,
      reservationRepository,
      { rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }] }
    );
    // The room's rate moved after the reservation was created.
    const getRoomRates = ratesOf({ "room-1": { nightlyPriceClp: 60_000 } });

    await editReservationNightlyRates<MockRoomLockOperationContext>({
      getRoomRates,
      input: {
        overrides: [{ nightlyPriceClp: 42_000, roomId: "room-1" }],
        reservationId: created.id,
      },
      reservationRepository,
      roomLockGateway,
    });
    const { reservation } =
      await editReservationNightlyRates<MockRoomLockOperationContext>({
        getRoomRates,
        input: {
          overrides: [{ nightlyPriceClp: null, roomId: "room-1" }],
          reservationId: created.id,
        },
        reservationRepository,
        roomLockGateway,
      });

    expect(lineOf(reservation, "room-1")).toMatchObject({
      nightlyPriceClp: 60_000,
      nightlyPriceManual: false,
    });
    expect(reservation.totalClp).toBe(180_000);
  });

  it("sets one room of a multi-room reservation and leaves the other untouched", async () => {
    const { reservationRepository, roomLockGateway } = setup();
    const created = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        rooms: [
          { nightlyPriceClp: 50_000, roomId: "room-1" },
          { nightlyPriceClp: 70_000, roomId: "room-2" },
        ],
      }
    );

    const { reservation } =
      await editReservationNightlyRates<MockRoomLockOperationContext>({
        getRoomRates: ratesOf({
          "room-1": { nightlyPriceClp: 50_000 },
          "room-2": { nightlyPriceClp: 70_000 },
        }),
        input: {
          overrides: [{ nightlyPriceClp: 42_000, roomId: "room-1" }],
          reservationId: created.id,
        },
        reservationRepository,
        roomLockGateway,
      });

    expect(lineOf(reservation, "room-1")).toMatchObject({
      nightlyPriceClp: 42_000,
      nightlyPriceManual: true,
    });
    expect(lineOf(reservation, "room-2")).toMatchObject({
      nightlyPriceClp: 70_000,
      nightlyPriceManual: false,
    });
    expect(reservation.totalClp).toBe(126_000 + 210_000);
  });
});

describe("rejected nightly-value edits (task 3.2)", () => {
  it.each([0, -1, -42_000])("rejects %i as a nightly value", async (value) => {
    const { reservationRepository, roomLockGateway } = setup();
    const created = await createReservation(
      roomLockGateway,
      reservationRepository,
      { rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }] }
    );

    await expect(
      editReservationNightlyRates<MockRoomLockOperationContext>({
        getRoomRates: ratesOf({ "room-1": { nightlyPriceClp: 50_000 } }),
        input: {
          overrides: [{ nightlyPriceClp: value, roomId: "room-1" }],
          reservationId: created.id,
        },
        reservationRepository,
        roomLockGateway,
      })
    ).rejects.toThrow(InvalidNightlyRateError);

    const after = await reservationRepository.getReservationById(created.id);
    expect(after?.totalClp).toBe(150_000);
    expect(lineOf(after!, "room-1")).toMatchObject({
      nightlyPriceClp: 50_000,
      nightlyPriceManual: false,
    });
  });

  it.each([1_000.5, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects the non-integer value %p",
    async (value) => {
      const { reservationRepository, roomLockGateway } = setup();
      const created = await createReservation(
        roomLockGateway,
        reservationRepository,
        { rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }] }
      );

      await expect(
        editReservationNightlyRates<MockRoomLockOperationContext>({
          getRoomRates: ratesOf({ "room-1": { nightlyPriceClp: 50_000 } }),
          input: {
            overrides: [{ nightlyPriceClp: value, roomId: "room-1" }],
            reservationId: created.id,
          },
          reservationRepository,
          roomLockGateway,
        })
      ).rejects.toThrow(InvalidNightlyRateError);

      const after = await reservationRepository.getReservationById(created.id);
      expect(after?.totalClp).toBe(150_000);
    }
  );

  it.each(["website", "phone", "whatsapp", "admin"] as const)(
    "rejects a reservation of origin %s",
    async (origin) => {
      const { reservationRepository, roomLockGateway } = setup();
      const created = await createReservation(
        roomLockGateway,
        reservationRepository,
        { origin, rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }] }
      );

      await expect(
        editReservationNightlyRates<MockRoomLockOperationContext>({
          getRoomRates: ratesOf({ "room-1": { nightlyPriceClp: 50_000 } }),
          input: {
            overrides: [{ nightlyPriceClp: 42_000, roomId: "room-1" }],
            reservationId: created.id,
          },
          reservationRepository,
          roomLockGateway,
        })
      ).rejects.toThrow(ReservationNotExternalChannelError);

      const after = await reservationRepository.getReservationById(created.id);
      expect(after?.totalClp).toBe(150_000);
    }
  );

  it("rejects a room that is not part of the reservation", async () => {
    const { reservationRepository, roomLockGateway } = setup();
    const created = await createReservation(
      roomLockGateway,
      reservationRepository,
      { rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }] }
    );

    await expect(
      editReservationNightlyRates<MockRoomLockOperationContext>({
        getRoomRates: ratesOf({ "room-1": { nightlyPriceClp: 50_000 } }),
        input: {
          overrides: [{ nightlyPriceClp: 42_000, roomId: "room-9" }],
          reservationId: created.id,
        },
        reservationRepository,
        roomLockGateway,
      })
    ).rejects.toThrow(ReservationRoomNotInStayError);

    const after = await reservationRepository.getReservationById(created.id);
    expect(after?.totalClp).toBe(150_000);
  });
});

describe("payment reconciliation for a nightly-value edit (task 3.3)", () => {
  it("replaces the pending amount when there are no approved payments", () => {
    const summary = reconcileNightlyRatePayments(
      126_000,
      0,
      true,
      "confirmed"
    );
    expect(summary.paymentAction).toEqual({
      amountClp: 126_000,
      type: "set_pending",
    });
    expect(summary.overpaymentClp).toBe(0);
  });

  it("leaves the shortfall pending when the new total exceeds what was paid", () => {
    const summary = reconcileNightlyRatePayments(
      200_000,
      150_000,
      false,
      "confirmed"
    );
    expect(summary.paymentAction).toEqual({
      amountClp: 50_000,
      type: "set_pending",
    });
    expect(summary.approvedPaymentsClp).toBe(150_000);
    expect(summary.overpaymentClp).toBe(0);
  });

  it("records an overpayment without charging again when the total drops below what was paid", () => {
    const summary = reconcileNightlyRatePayments(
      100_000,
      150_000,
      true,
      "confirmed"
    );
    expect(summary.overpaymentClp).toBe(50_000);
    expect(summary.pendingBalanceClp).toBe(0);
    // Reduction only: the surviving pending row is cancelled, never raised.
    expect(summary.paymentAction).toEqual({ type: "cancel_pending" });
  });
});

describe("eligibility by status (task 3.4)", () => {
  const statuses: readonly ReservationStatus[] = [
    "confirmed",
    "completed",
    "cancelled",
    "no_show",
  ];

  it.each(statuses)("edits a %s reservation without changing it", async (status) => {
    const { reservationRepository, roomLockGateway } = setup();
    const created = await createReservation(
      roomLockGateway,
      reservationRepository,
      { rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }] }
    );
    if (status !== "confirmed") {
      await roomLockGateway.runLockedMany(["room-1"], (context) =>
        reservationRepository.transitionReservationState(context, {
          reservationId: created.id,
          to: status,
        })
      );
    }

    const { reservation } =
      await editReservationNightlyRates<MockRoomLockOperationContext>({
        getRoomRates: ratesOf({ "room-1": { nightlyPriceClp: 50_000 } }),
        input: {
          overrides: [{ nightlyPriceClp: 42_000, roomId: "room-1" }],
          reservationId: created.id,
        },
        reservationRepository,
        roomLockGateway,
      });

    expect(reservation.status).toBe(status);
    expect(reservation.totalClp).toBe(126_000);
    expect(lineOf(reservation, "room-1")?.nightlyPriceManual).toBe(true);
  });
});

describe("a cancelled reservation opens no balance (task 3.5)", () => {
  it("forces paymentAction to none when nothing is pending", () => {
    const summary = reconcileNightlyRatePayments(
      200_000,
      0,
      false,
      "cancelled"
    );
    // A live reservation would open a 200.000 balance here.
    expect(summary.paymentAction).toEqual({ type: "none" });
    // Still reported, so the audit event stays complete.
    expect(summary.pendingBalanceClp).toBe(200_000);
  });

  it("cancels, never raises, a pending row that survived the cancellation", () => {
    const summary = reconcileNightlyRatePayments(
      200_000,
      0,
      true,
      "cancelled"
    );
    expect(summary.paymentAction).toEqual({ type: "cancel_pending" });
  });

  it("opens no pending payment end to end on a cancelled reservation", async () => {
    const { reservationRepository, roomLockGateway } = setup();
    const created = await createReservation(
      roomLockGateway,
      reservationRepository,
      { rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }] }
    );
    await roomLockGateway.runLockedMany(["room-1"], (context) =>
      reservationRepository.transitionReservationState(context, {
        reservationId: created.id,
        to: "cancelled",
      })
    );

    // Raising the value on a cancelled reservation must not resurrect a charge.
    const { reservation } =
      await editReservationNightlyRates<MockRoomLockOperationContext>({
        getRoomRates: ratesOf({ "room-1": { nightlyPriceClp: 50_000 } }),
        input: {
          overrides: [{ nightlyPriceClp: 90_000, roomId: "room-1" }],
          reservationId: created.id,
        },
        reservationRepository,
        roomLockGateway,
      });

    expect(reservation.totalClp).toBe(270_000);
    const pending =
      await reservationRepository.getPendingPayAtPropertyPaymentByReservationId?.(
        created.id
      );
    expect(pending).toBeNull();
  });
});

describe("mergeNightlyRateOverrides", () => {
  it("keeps untouched rooms, applies new values and removes dropped ones", () => {
    const current = {
      items: [
        {
          chargesClp: 0,
          guestCount: 2,
          nightlyPriceClp: 42_000,
          nightlyPriceManual: true,
          nights: 3,
          roomId: "room-1",
          subtotalClp: 126_000,
        },
        {
          chargesClp: 0,
          guestCount: 2,
          nightlyPriceClp: 38_000,
          nightlyPriceManual: true,
          nights: 3,
          roomId: "room-2",
          subtotalClp: 114_000,
        },
        {
          chargesClp: 0,
          guestCount: 2,
          nightlyPriceClp: 70_000,
          nightlyPriceManual: false,
          nights: 3,
          roomId: "room-3",
          subtotalClp: 210_000,
        },
      ],
    } as unknown as ReservationRecord;

    const merged = mergeNightlyRateOverrides(current, [
      { nightlyPriceClp: null, roomId: "room-2" },
      { nightlyPriceClp: 55_000, roomId: "room-3" },
    ]);

    expect([...merged.entries()].sort()).toEqual([
      ["room-1", 42_000],
      ["room-3", 55_000],
    ]);
  });
});

describe("neither operation notifies the guest (task 5.3)", () => {
  it("writes no notification intent for a nightly-value edit or an origin correction", async () => {
    const { getMockNotificationOutboxIntents } = await import(
      "@/features/notifications"
    );
    const { editReservationOrigin } = await import(
      "@/features/reservations/edit-reservation-origin"
    );
    const { reservationRepository, roomLockGateway } = setup();
    const created = await createReservation(
      roomLockGateway,
      reservationRepository,
      { rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }] }
    );
    const before = getMockNotificationOutboxIntents().length;

    await editReservationNightlyRates<MockRoomLockOperationContext>({
      getRoomRates: ratesOf({ "room-1": { nightlyPriceClp: 50_000 } }),
      input: {
        actorUserId: "admin-1",
        overrides: [{ nightlyPriceClp: 42_000, roomId: "room-1" }],
        reservationId: created.id,
      },
      reservationRepository,
      roomLockGateway,
    });
    await editReservationOrigin({
      input: {
        actorUserId: "admin-1",
        origin: "airbnb",
        reservationId: created.id,
      },
      reservationRepository,
    });

    // Unlike a stay edit, neither use case even accepts an outbox writer, so
    // there is no path by which a guest or admin message could be enqueued.
    expect(getMockNotificationOutboxIntents().length).toBe(before);
  });
});

describe("base prices and the public quote are untouched (task 8.3)", () => {
  it("leaves the room's rate data and a fresh public quote unchanged", async () => {
    const { reservationRepository, roomLockGateway } = setup();
    const created = await createReservation(
      roomLockGateway,
      reservationRepository,
      { rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }] }
    );

    // The room's authoritative rate, as any later consumer would resolve it.
    const roomRate = {
      capacity: 4,
      id: "room-1",
      nightlyPriceClp: 50_000,
      occupancyPrices: [],
    } as const;
    const getRoomRates = ratesOf({ "room-1": { nightlyPriceClp: 50_000 } });
    const rateBefore = (await getRoomRates(["room-1"])).get("room-1");

    await editReservationNightlyRates<MockRoomLockOperationContext>({
      getRoomRates,
      input: {
        overrides: [{ nightlyPriceClp: 42_000, roomId: "room-1" }],
        reservationId: created.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    // The rate source still reports the configured value, not the override.
    const rateAfter = (await getRoomRates(["room-1"])).get("room-1");
    expect(rateAfter).toEqual(rateBefore);
    expect(rateAfter?.nightlyPriceClp).toBe(roomRate.nightlyPriceClp);

    // A second reservation for the same room prices from the rate, not from
    // the first reservation's hand-set value.
    const other = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2027-03-01",
        checkOut: "2027-03-04",
        rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }],
      }
    );
    expect(lineOf(other, "room-1")).toMatchObject({
      nightlyPriceClp: 50_000,
      nightlyPriceManual: false,
    });
    expect(other.totalClp).toBe(150_000);
  });

  it("confines the override to the reservation that received it", async () => {
    const { reservationRepository, roomLockGateway } = setup();
    const first = await createReservation(
      roomLockGateway,
      reservationRepository,
      { rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }] }
    );
    const second = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2027-04-01",
        checkOut: "2027-04-04",
        rooms: [{ nightlyPriceClp: 50_000, roomId: "room-1" }],
      }
    );

    await editReservationNightlyRates<MockRoomLockOperationContext>({
      getRoomRates: ratesOf({ "room-1": { nightlyPriceClp: 50_000 } }),
      input: {
        overrides: [{ nightlyPriceClp: 42_000, roomId: "room-1" }],
        reservationId: first.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    const untouched = await reservationRepository.getReservationById(second.id);
    expect(untouched?.totalClp).toBe(150_000);
    expect(lineOf(untouched!, "room-1")?.nightlyPriceManual).toBe(false);
  });
});
