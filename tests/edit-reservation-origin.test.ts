import { describe, expect, it } from "vitest";

import {
  createLodgingInterval,
  createMockRoomLockGateway,
  type MockRoomLockOperationContext,
} from "@/features/availability";
import {
  correctableOrigins,
  correctionDropsManualRates,
  editReservationOrigin,
  InvalidReservationOriginError,
  parseReservationOrigin,
} from "@/features/reservations/edit-reservation-origin";
import { editReservationNightlyRates } from "@/features/reservations/edit-reservation-nightly-rates";
import type { ReservationStayRoomRate } from "@/features/reservations/edit-reservation-stay";
import {
  createMockReservationRepository,
  type ReservationOrigin,
  type ReservationRecord,
  type ReservationStatus,
} from "@/features/reservations/reservation-repository";

let publicIdCounter = 0;

function ratesOf(
  nightlyPriceClp: number
): (
  roomIds: readonly string[]
) => Promise<ReadonlyMap<string, ReservationStayRoomRate>> {
  return async (roomIds) =>
    new Map(
      roomIds.map((roomId) => [
        roomId,
        Object.freeze({
          capacity: 4,
          id: roomId,
          nightlyPriceClp,
          occupancyPrices: [],
        }),
      ])
    );
}

async function createReservation(
  origin: ReservationOrigin = "airbnb",
  nightlyPriceClp = 50_000
) {
  const gateway = createMockRoomLockGateway();
  const repository = createMockReservationRepository();
  const interval = createLodgingInterval("2026-11-01", "2026-11-04");
  const { reservation } = await gateway.runExclusiveMany(
    ["room-1"],
    interval,
    (context: MockRoomLockOperationContext) =>
      repository.createConfirmedPayAtPropertyReservation(context, {
        checkIn: interval.checkIn,
        checkOut: interval.checkOut,
        guestCount: 2,
        guestId: "guest-1",
        items: [
          {
            chargesClp: 0,
            guestCount: 2,
            nightlyPriceClp,
            nights: 3,
            roomId: "room-1",
            totalClp: 3 * nightlyPriceClp,
          },
        ],
        origin,
        publicId: `VV-ORIGIN-${(publicIdCounter += 1)}`,
      })
  );
  return { created: reservation, gateway, repository };
}

function lineOf(reservation: ReservationRecord, roomId: string) {
  return reservation.items.find((item) => item.roomId === roomId);
}

describe("parseReservationOrigin", () => {
  it.each(correctableOrigins)("accepts %s", (origin) => {
    expect(parseReservationOrigin(origin)).toBe(origin);
  });

  it("covers all six origins of the system", () => {
    expect([...correctableOrigins].sort()).toEqual([
      "admin",
      "airbnb",
      "booking",
      "phone",
      "website",
      "whatsapp",
    ]);
  });

  it.each(["", "Booking", "hotel", 42, null, undefined])(
    "rejects %p",
    (candidate) => {
      expect(() => parseReservationOrigin(candidate)).toThrow(
        InvalidReservationOriginError
      );
    }
  );
});

describe("correctionDropsManualRates", () => {
  const withManual = {
    items: [{ nightlyPriceManual: true }, { nightlyPriceManual: false }],
  };
  const withoutManual = { items: [{ nightlyPriceManual: false }] };

  it.each(["admin", "phone", "whatsapp", "website"] as const)(
    "is true for %s when a line carries a hand-set value",
    (origin) => {
      expect(correctionDropsManualRates(withManual, origin)).toBe(true);
    }
  );

  it.each(["airbnb", "booking"] as const)(
    "is false for %s even with a hand-set value",
    (origin) => {
      expect(correctionDropsManualRates(withManual, origin)).toBe(false);
    }
  );

  it.each(correctableOrigins)(
    "is false for %s when no line carries one",
    (origin) => {
      expect(correctionDropsManualRates(withoutManual, origin)).toBe(false);
    }
  );
});

describe("editReservationOrigin — pure relabelling", () => {
  it("corrects an admin reservation to booking", async () => {
    const { created, repository } = await createReservation("admin");

    const { reservation, financialSummary } = await editReservationOrigin({
      input: {
        actorUserId: "admin-1",
        origin: "booking",
        reservationId: created.id,
      },
      reservationRepository: repository,
    });

    expect(reservation.origin).toBe("booking");
    expect(financialSummary).toBeUndefined();
    expect(reservation.totalClp).toBe(created.totalClp);
    expect(reservation.items).toEqual(created.items);
  });

  it.each([
    ["website", "booking"],
    ["phone", "airbnb"],
    ["whatsapp", "admin"],
    ["booking", "airbnb"],
    ["admin", "whatsapp"],
    ["airbnb", "website"],
  ] as const)("corrects %s to %s", async (from, to) => {
    const { created, repository } = await createReservation(from);

    const { reservation } = await editReservationOrigin({
      input: { origin: to, reservationId: created.id },
      reservationRepository: repository,
    });

    expect(reservation.origin).toBe(to);
    expect(reservation.totalClp).toBe(created.totalClp);
  });

  it.each(["completed", "cancelled", "no_show"] as const)(
    "corrects a %s reservation and keeps that status",
    async (status: ReservationStatus) => {
      const { created, gateway, repository } = await createReservation("admin");
      await gateway.runLockedMany(["room-1"], (context) =>
        repository.transitionReservationState(context, {
          reservationId: created.id,
          to: status as Exclude<ReservationStatus, "confirmed">,
        })
      );

      const { reservation } = await editReservationOrigin({
        input: { origin: "booking", reservationId: created.id },
        reservationRepository: repository,
      });

      expect(reservation.origin).toBe("booking");
      expect(reservation.status).toBe(status);
    }
  );

  it("does not touch payments", async () => {
    const { created, repository } = await editReservationOriginOnPaid();
    const pending =
      await repository.getPendingPayAtPropertyPaymentByReservationId?.(
        created.id
      );
    expect(pending?.amountClp).toBe(150_000);
  });

  async function editReservationOriginOnPaid() {
    const { created, repository } = await createReservation("admin");
    await editReservationOrigin({
      input: { origin: "phone", reservationId: created.id },
      reservationRepository: repository,
    });
    return { created, repository };
  }
});

describe("editReservationOrigin — dropping a hand-set value", () => {
  /** A booking reservation whose room was given a hand-set nightly value. */
  async function withManualRate() {
    const { created, gateway, repository } = await createReservation("booking");
    await editReservationNightlyRates<MockRoomLockOperationContext>({
      getRoomRates: ratesOf(50_000),
      input: {
        overrides: [{ nightlyPriceClp: 42_000, roomId: "room-1" }],
        reservationId: created.id,
      },
      reservationRepository: repository,
      roomLockGateway: gateway,
    });
    return { created, gateway, repository };
  }

  it("returns the room to its current rate and reprices the total", async () => {
    const { created, gateway, repository } = await withManualRate();
    const before = await repository.getReservationById(created.id);
    expect(before?.totalClp).toBe(126_000);
    expect(lineOf(before!, "room-1")?.nightlyPriceManual).toBe(true);

    const { reservation, financialSummary } = await editReservationOrigin({
      getRoomRates: ratesOf(60_000),
      input: {
        actorUserId: "admin-1",
        origin: "admin",
        reservationId: created.id,
      },
      reservationRepository: repository,
      roomLockGateway: gateway,
    });

    expect(reservation.origin).toBe("admin");
    // 3 nights at the room's current rate of 60.000, not the dropped 42.000.
    expect(reservation.totalClp).toBe(180_000);
    expect(lineOf(reservation, "room-1")).toMatchObject({
      nightlyPriceClp: 60_000,
      nightlyPriceManual: false,
    });
    expect(financialSummary?.pendingBalanceClp).toBe(180_000);
  });

  it("keeps the hand-set value when correcting between two channels", async () => {
    const { created, gateway, repository } = await withManualRate();

    const { reservation, financialSummary } = await editReservationOrigin({
      getRoomRates: ratesOf(60_000),
      input: { origin: "airbnb", reservationId: created.id },
      reservationRepository: repository,
      roomLockGateway: gateway,
    });

    expect(reservation.origin).toBe("airbnb");
    expect(financialSummary).toBeUndefined();
    expect(reservation.totalClp).toBe(126_000);
    expect(lineOf(reservation, "room-1")).toMatchObject({
      nightlyPriceClp: 42_000,
      nightlyPriceManual: true,
    });
  });

  it("opens no pending balance when the reservation is cancelled", async () => {
    const { created, gateway, repository } = await withManualRate();
    await gateway.runLockedMany(["room-1"], (context) =>
      repository.transitionReservationState(context, {
        reservationId: created.id,
        to: "cancelled",
      })
    );

    const { reservation } = await editReservationOrigin({
      getRoomRates: ratesOf(60_000),
      input: { origin: "admin", reservationId: created.id },
      reservationRepository: repository,
      roomLockGateway: gateway,
    });

    expect(reservation.origin).toBe("admin");
    expect(reservation.totalClp).toBe(180_000);
    expect(reservation.status).toBe("cancelled");
    const pending =
      await repository.getPendingPayAtPropertyPaymentByReservationId?.(
        created.id
      );
    expect(pending).toBeNull();
  });

  it("refuses to run without the dependencies needed to reprice", async () => {
    const { created, repository } = await withManualRate();

    await expect(
      editReservationOrigin({
        input: { origin: "admin", reservationId: created.id },
        reservationRepository: repository,
      })
    ).rejects.toThrow(/needs room rates and a lock gateway/);

    const after = await repository.getReservationById(created.id);
    // Nothing moved: not the origin, not the amount.
    expect(after?.origin).toBe("booking");
    expect(after?.totalClp).toBe(126_000);
  });
});
