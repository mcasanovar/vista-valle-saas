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
  assertReservationDatesEditable,
  computeReservationDateEditFinancialSummary,
  editReservationDates,
  parseRequestedEditInterval,
  recalculateReservationDatesPricing,
  ReservationDateEditIneligibleError,
  ReservationDateEditRoomRateMissingError,
  type ReservationDateEditRoomRate,
} from "@/features/reservations/edit-reservation-dates";
import {
  createMockReservationRepository,
  ReservationNotFoundError,
  type ReservationItemRecord,
  type ReservationRecord,
} from "@/features/reservations/reservation-repository";
import {
  createMockNotificationOutbox,
  createMockResendEmailAdapter,
  createNotificationDeliveryWorker,
  EmailDeliveryError,
  notificationEmailTemplateFixture,
  type NotificationTemplateDataSource,
} from "@/features/notifications";

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

describe("reservation date edit eligibility", () => {
  it.each(["website", "phone", "whatsapp", "admin"] as const)(
    "allows a confirmed %s reservation",
    (origin) => {
      expect(() =>
        assertReservationDatesEditable(buildReservation({ origin }))
      ).not.toThrow();
    }
  );

  it.each(["airbnb", "booking"] as const)(
    "rejects a %s reservation regardless of status",
    (origin) => {
      expect(() =>
        assertReservationDatesEditable(buildReservation({ origin }))
      ).toThrow(ReservationDateEditIneligibleError);
    }
  );

  it.each(["cancelled", "completed", "no_show"] as const)(
    "allows a %s reservation as long as its origin is eligible",
    (status) => {
      expect(() =>
        assertReservationDatesEditable(buildReservation({ status }))
      ).not.toThrow();
    }
  );

  it("rejects an ineligible origin even when the status would otherwise be allowed", () => {
    try {
      assertReservationDatesEditable(
        buildReservation({ origin: "airbnb", status: "cancelled" })
      );
      throw new Error("expected assertion to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ReservationDateEditIneligibleError);
      expect((error as ReservationDateEditIneligibleError).origin).toBe(
        "airbnb"
      );
    }
  });
});

describe("reservation date edit interval parsing", () => {
  it("parses a valid interval", () => {
    const interval = parseRequestedEditInterval({
      checkIn: "2026-11-01",
      checkOut: "2026-11-04",
      reservationId: "reservation-1",
    });
    expect(interval).toEqual({ checkIn: "2026-11-01", checkOut: "2026-11-04" });
  });

  it("rejects a check-out equal to check-in", () => {
    expect(() =>
      parseRequestedEditInterval({
        checkIn: "2026-11-01",
        checkOut: "2026-11-01",
        reservationId: "reservation-1",
      })
    ).toThrow(InvalidLodgingIntervalError);
  });

  it("rejects a check-out before check-in", () => {
    expect(() =>
      parseRequestedEditInterval({
        checkIn: "2026-11-04",
        checkOut: "2026-11-01",
        reservationId: "reservation-1",
      })
    ).toThrow(InvalidLodgingIntervalError);
  });
});

function buildItem(
  overrides: Partial<ReservationItemRecord> = {}
): ReservationItemRecord {
  return Object.freeze({
    chargesClp: 0,
    guestCount: 2,
    nightlyPriceClp: 50_000,
    nights: 3,
    roomId: "room-1",
    subtotalClp: 150_000,
    ...overrides,
  });
}

function buildRate(
  overrides: Partial<ReservationDateEditRoomRate> = {}
): ReservationDateEditRoomRate {
  return Object.freeze({
    capacity: 4,
    id: "room-1",
    nightlyPriceClp: 50_000,
    occupancyPrices: [],
    ...overrides,
  });
}

describe("reservation date edit pricing recalculation", () => {
  it("recalculates nights, subtotal and total for a single room using the current rate", () => {
    const interval = createLodgingInterval("2026-11-01", "2026-11-05");
    const result = recalculateReservationDatesPricing(
      interval,
      [buildItem({ guestCount: 2, nightlyPriceClp: 50_000, roomId: "room-1" })],
      new Map([["room-1", buildRate({ nightlyPriceClp: 60_000 })]])
    );

    expect(result.nights).toBe(4);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      chargesClp: 0,
      guestCount: 2,
      nightlyPriceClp: 60_000,
      nights: 4,
      roomId: "room-1",
      totalClp: 240_000,
    });
    expect(result.totalClp).toBe(240_000);
  });

  it("uses the current per-occupancy price instead of the frozen item price", () => {
    const interval = createLodgingInterval("2026-11-01", "2026-11-04");
    const result = recalculateReservationDatesPricing(
      interval,
      [buildItem({ guestCount: 1, nightlyPriceClp: 50_000, roomId: "room-1" })],
      new Map([
        [
          "room-1",
          buildRate({
            nightlyPriceClp: 50_000,
            occupancyPrices: [{ occupancy: 1, priceClp: 35_000 }],
          }),
        ],
      ])
    );

    expect(result.items[0]?.nightlyPriceClp).toBe(35_000);
    expect(result.totalClp).toBe(105_000);
  });

  it("recalculates and aggregates totals across several rooms", () => {
    const interval = createLodgingInterval("2026-12-01", "2026-12-03");
    const result = recalculateReservationDatesPricing(
      interval,
      [
        buildItem({ guestCount: 2, roomId: "room-a" }),
        buildItem({ guestCount: 1, roomId: "room-b" }),
      ],
      new Map([
        ["room-a", buildRate({ id: "room-a", nightlyPriceClp: 40_000 })],
        ["room-b", buildRate({ id: "room-b", nightlyPriceClp: 30_000 })],
      ])
    );

    expect(result.nights).toBe(2);
    expect(result.totalClp).toBe(2 * 40_000 + 2 * 30_000);
    expect(result.items.map((item) => item.roomId).sort()).toEqual([
      "room-a",
      "room-b",
    ]);
  });

  it("never uses a client-supplied total: only dates, persisted guests and current rates feed the calculation", () => {
    const interval = createLodgingInterval("2026-12-01", "2026-12-02");
    const result = recalculateReservationDatesPricing(
      interval,
      [buildItem({ guestCount: 2, nightlyPriceClp: 999_999, roomId: "room-1" })],
      new Map([["room-1", buildRate({ nightlyPriceClp: 50_000 })]])
    );

    expect(result.totalClp).toBe(50_000);
  });

  it("throws when a room's current rate is missing", () => {
    const interval = createLodgingInterval("2026-12-01", "2026-12-02");
    expect(() =>
      recalculateReservationDatesPricing(
        interval,
        [buildItem({ roomId: "room-missing" })],
        new Map()
      )
    ).toThrow(ReservationDateEditRoomRateMissingError);
  });
});

describe("reservation date edit financial summary", () => {
  it("targets the full recalculated total when there are no approved payments", () => {
    const summary = computeReservationDateEditFinancialSummary(
      200_000,
      0,
      true
    );
    expect(summary.pendingBalanceClp).toBe(200_000);
    expect(summary.overpaymentClp).toBe(0);
    expect(summary.paymentAction).toEqual({
      type: "set_pending",
      amountClp: 200_000,
    });
  });

  it("creates a separate balance for the difference when the total grows past what was approved", () => {
    const summary = computeReservationDateEditFinancialSummary(
      250_000,
      150_000,
      false
    );
    expect(summary.pendingBalanceClp).toBe(100_000);
    expect(summary.overpaymentClp).toBe(0);
    expect(summary.paymentAction).toEqual({
      type: "set_pending",
      amountClp: 100_000,
    });
  });

  it("flags an overpayment for manual resolution without creating a new charge", () => {
    const summary = computeReservationDateEditFinancialSummary(
      100_000,
      150_000,
      false
    );
    expect(summary.pendingBalanceClp).toBe(0);
    expect(summary.overpaymentClp).toBe(50_000);
    expect(summary.paymentAction).toEqual({ type: "none" });
  });

  it("cancels a leftover pending balance once approved payments cover the new total exactly", () => {
    const summary = computeReservationDateEditFinancialSummary(
      100_000,
      100_000,
      true
    );
    expect(summary.pendingBalanceClp).toBe(0);
    expect(summary.overpaymentClp).toBe(0);
    expect(summary.paymentAction).toEqual({ type: "cancel_pending" });
  });

  it("does nothing when the balance is settled and there is no pending row to cancel", () => {
    const summary = computeReservationDateEditFinancialSummary(
      100_000,
      100_000,
      false
    );
    expect(summary.paymentAction).toEqual({ type: "none" });
  });
});

describe("editReservationDates transactional operation", () => {
  function ratesOf(
    rates: Record<string, Pick<ReservationDateEditRoomRate, "nightlyPriceClp">>
  ) {
    return async (roomIds: readonly string[]) =>
      new Map(
        roomIds.map((roomId) => [
          roomId,
          Object.freeze({
            capacity: 4,
            id: roomId,
            nightlyPriceClp: rates[roomId]!.nightlyPriceClp,
            occupancyPrices: [],
          }),
        ])
      );
  }

  async function createReservation(
    roomLockGateway: ReturnType<typeof createMockRoomLockGateway>,
    reservationRepository: ReturnType<typeof createMockReservationRepository>,
    params: Readonly<{
      checkIn: string;
      checkOut: string;
      guestCount?: number;
      nightlyPriceClp: number;
      publicId: string;
      roomId: string;
    }>
  ) {
    const interval = createLodgingInterval(params.checkIn, params.checkOut);
    const nights = lodgingNights(interval.checkIn, interval.checkOut);
    const { reservation } = await roomLockGateway.runExclusiveMany(
      [params.roomId],
      interval,
      (context: MockRoomLockOperationContext) =>
        reservationRepository.createConfirmedPayAtPropertyReservation(
          context,
          {
            checkIn: interval.checkIn,
            checkOut: interval.checkOut,
            guestCount: params.guestCount ?? 2,
            guestId: "guest-1",
            items: [
              {
                chargesClp: 0,
                guestCount: params.guestCount ?? 2,
                nightlyPriceClp: params.nightlyPriceClp,
                nights,
                roomId: params.roomId,
                totalClp: nights * params.nightlyPriceClp,
              },
            ],
            publicId: params.publicId,
          }
        )
    );
    return reservation;
  }

  it("extends a one-room reservation and updates dates, price and occupancy", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-10-05",
        checkOut: "2026-10-08",
        nightlyPriceClp: 50_000,
        publicId: "VV-extend",
        roomId: "room-1",
      }
    );

    const { reservation: updated } = await editReservationDates({
      getRoomRates: ratesOf({ "room-1": { nightlyPriceClp: 50_000 } }),
      input: {
        checkIn: "2026-10-05",
        checkOut: "2026-10-10",
        reservationId: reservation.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    expect(updated.checkIn).toBe("2026-10-05");
    expect(updated.checkOut).toBe("2026-10-10");
    expect(updated.totalClp).toBe(5 * 50_000);

    // The extended interval is now occupied...
    await expect(
      roomLockGateway.runExclusiveMany(
        ["room-1"],
        createLodgingInterval("2026-10-09", "2026-10-11"),
        async () => "ok"
      )
    ).rejects.toBeInstanceOf(RoomLockConflictError);
    // ...and the nights freed by the (later) original check-out are available again.
    await expect(
      roomLockGateway.runExclusiveMany(
        ["room-1"],
        createLodgingInterval("2026-10-11", "2026-10-12"),
        async () => "ok"
      )
    ).resolves.toBe("ok");
  });

  it("reduces a reservation and frees the vacated nights", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-11-01",
        checkOut: "2026-11-10",
        nightlyPriceClp: 40_000,
        publicId: "VV-reduce",
        roomId: "room-2",
      }
    );

    const { reservation: updated } = await editReservationDates({
      getRoomRates: ratesOf({ "room-2": { nightlyPriceClp: 40_000 } }),
      input: {
        checkIn: "2026-11-01",
        checkOut: "2026-11-03",
        reservationId: reservation.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    expect(updated.checkOut).toBe("2026-11-03");
    expect(updated.totalClp).toBe(2 * 40_000);

    await expect(
      roomLockGateway.runExclusiveMany(
        ["room-2"],
        createLodgingInterval("2026-11-04", "2026-11-09"),
        async () => "ok"
      )
    ).resolves.toBe("ok");
  });

  it("updates every item of a multi-room reservation atomically", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const interval = createLodgingInterval("2027-01-05", "2027-01-08");
    const { reservation } = await roomLockGateway.runExclusiveMany(
      ["room-a", "room-b"],
      interval,
      (context: MockRoomLockOperationContext) =>
        reservationRepository.createConfirmedPayAtPropertyReservation(
          context,
          {
            checkIn: interval.checkIn,
            checkOut: interval.checkOut,
            guestCount: 3,
            guestId: "guest-multi",
            items: [
              {
                chargesClp: 0,
                guestCount: 2,
                nightlyPriceClp: 40_000,
                nights: 3,
                roomId: "room-a",
                totalClp: 120_000,
              },
              {
                chargesClp: 0,
                guestCount: 1,
                nightlyPriceClp: 30_000,
                nights: 3,
                roomId: "room-b",
                totalClp: 90_000,
              },
            ],
            publicId: "VV-multi",
          }
        )
    );

    const { reservation: updated } = await editReservationDates({
      getRoomRates: ratesOf({
        "room-a": { nightlyPriceClp: 40_000 },
        "room-b": { nightlyPriceClp: 30_000 },
      }),
      input: {
        checkIn: "2027-01-05",
        checkOut: "2027-01-10",
        reservationId: reservation.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    expect(updated.items).toHaveLength(2);
    expect(updated.items.every((item) => item.nights === 5)).toBe(true);
    expect(updated.totalClp).toBe(5 * 40_000 + 5 * 30_000);
  });

  it("rejects a concurrent conflict and leaves dates, price and availability untouched", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-12-01",
        checkOut: "2026-12-03",
        nightlyPriceClp: 45_000,
        publicId: "VV-conflict-a",
        roomId: "room-3",
      }
    );
    await createReservation(roomLockGateway, reservationRepository, {
      checkIn: "2026-12-05",
      checkOut: "2026-12-08",
      nightlyPriceClp: 45_000,
      publicId: "VV-conflict-b",
      roomId: "room-3",
    });

    await expect(
      editReservationDates({
        getRoomRates: ratesOf({ "room-3": { nightlyPriceClp: 45_000 } }),
        input: {
          checkIn: "2026-12-01",
          checkOut: "2026-12-06",
          reservationId: reservation.id,
        },
        reservationRepository,
        roomLockGateway,
      })
    ).rejects.toBeInstanceOf(RoomLockConflictError);

    const unchanged = await reservationRepository.getReservationById(
      reservation.id
    );
    expect(unchanged?.checkIn).toBe("2026-12-01");
    expect(unchanged?.checkOut).toBe("2026-12-03");
    expect(unchanged?.totalClp).toBe(2 * 45_000);
    // Availability is unaffected: the second reservation's own interval is still occupied.
    await expect(
      roomLockGateway.runExclusiveMany(
        ["room-3"],
        createLodgingInterval("2026-12-06", "2026-12-07"),
        async () => "ok"
      )
    ).rejects.toBeInstanceOf(RoomLockConflictError);
  });

  it("rejects editing an Airbnb reservation and leaves it untouched", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const { reservation } = await roomLockGateway.runExclusiveMany(
      ["room-4"],
      createLodgingInterval("2026-09-01", "2026-09-03"),
      (context: MockRoomLockOperationContext) =>
        reservationRepository.createConfirmedPayAtPropertyReservation(
          context,
          {
            checkIn: "2026-09-01",
            checkOut: "2026-09-03",
            guestCount: 1,
            guestId: "guest-airbnb",
            items: [
              {
                chargesClp: 0,
                guestCount: 1,
                nightlyPriceClp: 50_000,
                nights: 2,
                roomId: "room-4",
                totalClp: 100_000,
              },
            ],
            origin: "airbnb",
            publicId: "VV-airbnb",
          }
        )
    );

    await expect(
      editReservationDates({
        getRoomRates: ratesOf({ "room-4": { nightlyPriceClp: 50_000 } }),
        input: {
          checkIn: "2026-09-01",
          checkOut: "2026-09-05",
          reservationId: reservation.id,
        },
        reservationRepository,
        roomLockGateway,
      })
    ).rejects.toThrow(ReservationDateEditIneligibleError);

    const unchanged = await reservationRepository.getReservationById(
      reservation.id
    );
    expect(unchanged?.checkOut).toBe("2026-09-03");
  });

  it("rejects an unknown reservation id", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();

    await expect(
      editReservationDates({
        getRoomRates: ratesOf({}),
        input: {
          checkIn: "2026-09-01",
          checkOut: "2026-09-05",
          reservationId: "missing-reservation",
        },
        reservationRepository,
        roomLockGateway,
      })
    ).rejects.toBeInstanceOf(ReservationNotFoundError);
  });
});

describe("editReservationDates payment integration", () => {
  function ratesOf(
    rates: Record<string, Pick<ReservationDateEditRoomRate, "nightlyPriceClp">>
  ) {
    return async (roomIds: readonly string[]) =>
      new Map(
        roomIds.map((roomId) => [
          roomId,
          Object.freeze({
            capacity: 4,
            id: roomId,
            nightlyPriceClp: rates[roomId]!.nightlyPriceClp,
            occupancyPrices: [],
          }),
        ])
      );
  }

  async function createReservation(
    roomLockGateway: ReturnType<typeof createMockRoomLockGateway>,
    reservationRepository: ReturnType<typeof createMockReservationRepository>,
    params: Readonly<{
      checkIn: string;
      checkOut: string;
      nightlyPriceClp: number;
      publicId: string;
      roomId: string;
    }>
  ) {
    const interval = createLodgingInterval(params.checkIn, params.checkOut);
    const nights = lodgingNights(interval.checkIn, interval.checkOut);
    const { reservation } = await roomLockGateway.runExclusiveMany(
      [params.roomId],
      interval,
      (context: MockRoomLockOperationContext) =>
        reservationRepository.createConfirmedPayAtPropertyReservation(
          context,
          {
            checkIn: interval.checkIn,
            checkOut: interval.checkOut,
            guestCount: 2,
            guestId: "guest-payments",
            items: [
              {
                chargesClp: 0,
                guestCount: 2,
                nightlyPriceClp: params.nightlyPriceClp,
                nights,
                roomId: params.roomId,
                totalClp: nights * params.nightlyPriceClp,
              },
            ],
            publicId: params.publicId,
          }
        )
    );
    return reservation;
  }

  it("replaces the pending amount for an unpaid reservation with the recalculated total", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-08-01",
        checkOut: "2026-08-03",
        nightlyPriceClp: 50_000,
        publicId: "VV-pay-unpaid",
        roomId: "room-pay-1",
      }
    );

    const { financialSummary } = await editReservationDates({
      getRoomRates: ratesOf({ "room-pay-1": { nightlyPriceClp: 50_000 } }),
      input: {
        checkIn: "2026-08-01",
        checkOut: "2026-08-05",
        reservationId: reservation.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    expect(financialSummary.pendingBalanceClp).toBe(4 * 50_000);
    expect(financialSummary.overpaymentClp).toBe(0);

    const pending =
      await reservationRepository.getPendingPayAtPropertyPaymentByReservationId!(
        reservation.id
      );
    expect(pending?.amountClp).toBe(4 * 50_000);
  });

  it("keeps the approved payment and opens a separate balance for an extension", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-08-10",
        checkOut: "2026-08-12",
        nightlyPriceClp: 60_000,
        publicId: "VV-pay-approved",
        roomId: "room-pay-2",
      }
    );
    const approved =
      await reservationRepository.approvePayAtPropertyPayment!(
        reservation.id
      );
    expect(approved.status).toBe("approved");

    const { financialSummary } = await editReservationDates({
      getRoomRates: ratesOf({ "room-pay-2": { nightlyPriceClp: 60_000 } }),
      input: {
        checkIn: "2026-08-10",
        checkOut: "2026-08-14",
        reservationId: reservation.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    expect(financialSummary.approvedPaymentsClp).toBe(2 * 60_000);
    expect(financialSummary.pendingBalanceClp).toBe(2 * 60_000);
    expect(financialSummary.overpaymentClp).toBe(0);

    const pending =
      await reservationRepository.getPendingPayAtPropertyPaymentByReservationId!(
        reservation.id
      );
    expect(pending?.amountClp).toBe(2 * 60_000);

    // The original approved payment is never mutated.
    const totalApproved =
      await reservationRepository.getApprovedPaymentsTotalClp!(
        reservation.id
      );
    expect(totalApproved).toBe(2 * 60_000);
  });

  it("flags an overpayment without creating a new charge when a paid reservation is reduced", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2026-08-20",
        checkOut: "2026-08-25",
        nightlyPriceClp: 50_000,
        publicId: "VV-pay-overpaid",
        roomId: "room-pay-3",
      }
    );
    await reservationRepository.approvePayAtPropertyPayment!(reservation.id);

    const { financialSummary } = await editReservationDates({
      getRoomRates: ratesOf({ "room-pay-3": { nightlyPriceClp: 50_000 } }),
      input: {
        checkIn: "2026-08-20",
        checkOut: "2026-08-22",
        reservationId: reservation.id,
      },
      reservationRepository,
      roomLockGateway,
    });

    expect(financialSummary.pendingBalanceClp).toBe(0);
    expect(financialSummary.overpaymentClp).toBe(3 * 50_000);

    const pending =
      await reservationRepository.getPendingPayAtPropertyPaymentByReservationId!(
        reservation.id
      );
    expect(pending).toBeNull();
    const totalApproved =
      await reservationRepository.getApprovedPaymentsTotalClp!(
        reservation.id
      );
    expect(totalApproved).toBe(5 * 50_000);
  });
});

describe("editReservationDates notifications", () => {
  function ratesOf(
    rates: Record<string, Pick<ReservationDateEditRoomRate, "nightlyPriceClp">>
  ) {
    return async (roomIds: readonly string[]) =>
      new Map(
        roomIds.map((roomId) => [
          roomId,
          Object.freeze({
            capacity: 4,
            id: roomId,
            nightlyPriceClp: rates[roomId]!.nightlyPriceClp,
            occupancyPrices: [],
          }),
        ])
      );
  }

  async function createReservation(
    roomLockGateway: ReturnType<typeof createMockRoomLockGateway>,
    reservationRepository: ReturnType<typeof createMockReservationRepository>,
    params: Readonly<{
      checkIn: string;
      checkOut: string;
      nightlyPriceClp: number;
      publicId: string;
      roomId: string;
    }>
  ) {
    const interval = createLodgingInterval(params.checkIn, params.checkOut);
    const nights = lodgingNights(interval.checkIn, interval.checkOut);
    const { reservation } = await roomLockGateway.runExclusiveMany(
      [params.roomId],
      interval,
      (context: MockRoomLockOperationContext) =>
        reservationRepository.createConfirmedPayAtPropertyReservation(
          context,
          {
            checkIn: interval.checkIn,
            checkOut: interval.checkOut,
            guestCount: 2,
            guestId: "guest-notifications",
            items: [
              {
                chargesClp: 0,
                guestCount: 2,
                nightlyPriceClp: params.nightlyPriceClp,
                nights,
                roomId: params.roomId,
                totalClp: nights * params.nightlyPriceClp,
              },
            ],
            publicId: params.publicId,
          }
        )
    );
    return reservation;
  }

  it("enqueues one idempotent admin intent per edit", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const outbox = createMockNotificationOutbox<MockRoomLockOperationContext>();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2027-02-01",
        checkOut: "2027-02-03",
        nightlyPriceClp: 50_000,
        publicId: "VV-notify-1",
        roomId: "room-notify-1",
      }
    );

    await editReservationDates({
      getRoomRates: ratesOf({ "room-notify-1": { nightlyPriceClp: 50_000 } }),
      input: {
        checkIn: "2027-02-01",
        checkOut: "2027-02-05",
        reservationId: reservation.id,
      },
      notificationOutboxWriter: outbox,
      reservationRepository,
      roomLockGateway,
    });

    const intents = outbox
      .list()
      .filter((intent) => intent.reservationId === reservation.id);
    expect(intents).toHaveLength(1);
    expect(intents[0]).toMatchObject({
      type: "reservation_dates_changed_admin",
    });

    // A second, distinct edit produces a new, distinct intent (no dedup across edits).
    await editReservationDates({
      getRoomRates: ratesOf({ "room-notify-1": { nightlyPriceClp: 50_000 } }),
      input: {
        checkIn: "2027-02-01",
        checkOut: "2027-02-06",
        reservationId: reservation.id,
      },
      notificationOutboxWriter: outbox,
      reservationRepository,
      roomLockGateway,
    });
    expect(
      outbox.list().filter((intent) => intent.reservationId === reservation.id)
    ).toHaveLength(2);
  });

  it("keeps the modification in place even when the email provider fails at delivery time", async () => {
    const roomLockGateway = createMockRoomLockGateway();
    const reservationRepository = createMockReservationRepository();
    const outbox = createMockNotificationOutbox<MockRoomLockOperationContext>();
    const reservation = await createReservation(
      roomLockGateway,
      reservationRepository,
      {
        checkIn: "2027-03-01",
        checkOut: "2027-03-03",
        nightlyPriceClp: 50_000,
        publicId: "VV-notify-2",
        roomId: "room-notify-2",
      }
    );

    const { reservation: edited } = await editReservationDates({
      getRoomRates: ratesOf({ "room-notify-2": { nightlyPriceClp: 50_000 } }),
      input: {
        checkIn: "2027-03-01",
        checkOut: "2027-03-05",
        reservationId: reservation.id,
      },
      notificationOutboxWriter: outbox,
      reservationRepository,
      roomLockGateway,
    });
    expect(edited.checkOut).toBe("2027-03-05");

    const source: NotificationTemplateDataSource = Object.freeze({
      getReservationEmailData: async () => ({
        ...notificationEmailTemplateFixture,
        checkIn: edited.checkIn,
        checkOut: edited.checkOut,
        guestCount: edited.guestCount,
        origin: edited.origin,
        publicId: edited.publicId,
        totalClp: edited.totalClp,
      }),
    });
    const failingAdapter = createMockResendEmailAdapter(async () => {
      throw new EmailDeliveryError("permanent", "delivery_permanent");
    });
    const worker = createNotificationDeliveryWorker(
      outbox,
      failingAdapter,
      source
    );
    await worker.processReady();

    const intent = outbox
      .list()
      .find((candidate) => candidate.reservationId === reservation.id);
    expect(intent).toMatchObject({ status: "failed" });

    const stillEdited = await reservationRepository.getReservationById(
      reservation.id
    );
    expect(stillEdited?.checkOut).toBe("2027-03-05");
    expect(stillEdited?.totalClp).toBe(edited.totalClp);
  });
});
