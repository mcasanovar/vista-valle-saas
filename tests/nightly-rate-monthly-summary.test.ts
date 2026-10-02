import { describe, expect, it } from "vitest";

import {
  aggregateMockMonthlySummary,
  type MockDashboardReservation,
  type MockDashboardRoom,
} from "@/features/admin/dashboard";
import type { ReservationOrigin, ReservationStatus } from "@/features/reservations";

const range = { from: "2026-11-01", to: "2026-11-30" } as const;

const rooms: readonly MockDashboardRoom[] = [
  {
    active: true,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    id: "room-1",
    name: "Valle",
  },
];

function reservation(
  params: Readonly<{
    approvedAmountClp: number;
    origin?: ReservationOrigin;
    status?: ReservationStatus;
  }>
): MockDashboardReservation {
  return {
    checkIn: "2026-11-10",
    checkOut: "2026-11-12",
    id: "reservation-1",
    origin: params.origin ?? "booking",
    payments: [
      {
        amountClp: params.approvedAmountClp,
        status: "approved",
      },
    ],
    roomId: "room-1",
    status: params.status ?? "confirmed",
  } as MockDashboardReservation;
}

describe("the monthly summary reflects a corrected nightly value (task 8.1)", () => {
  it("reports the corrected amount as the month's revenue", () => {
    // 2 nights at the room's rate of 60.000 before the correction.
    const before = aggregateMockMonthlySummary(
      [reservation({ approvedAmountClp: 120_000 })],
      rooms,
      range
    );
    expect(before.approvedRevenueClp).toBe(120_000);

    // After the administrator records what Booking actually charged: 42.000.
    const after = aggregateMockMonthlySummary(
      [reservation({ approvedAmountClp: 84_000 })],
      rooms,
      range
    );
    expect(after.approvedRevenueClp).toBe(84_000);
  });

  it("includes a completed reservation's corrected amount", () => {
    const summary = aggregateMockMonthlySummary(
      [reservation({ approvedAmountClp: 84_000, status: "completed" })],
      rooms,
      range
    );
    expect(summary.approvedRevenueClp).toBe(84_000);
  });

  it.each(["cancelled", "no_show"] as const)(
    "leaves the month's revenue untouched for a %s reservation",
    (status) => {
      const summary = aggregateMockMonthlySummary(
        [reservation({ approvedAmountClp: 270_000, status })],
        rooms,
        range
      );
      // Only confirmed and completed count, so editing a cancelled
      // reservation's value is bookkeeping, not revenue.
      expect(summary.approvedRevenueClp).toBe(0);
    }
  );

  it("counts a cancelled reservation only in its own tally", () => {
    const summary = aggregateMockMonthlySummary(
      [reservation({ approvedAmountClp: 270_000, status: "cancelled" })],
      rooms,
      range
    );
    expect(summary.cancelledReservationCount).toBe(1);
    expect(summary.validReservationCount).toBe(0);
  });
});

describe("a corrected channel re-attributes the reservation (task 8.2)", () => {
  function amountFor(
    summary: ReturnType<typeof aggregateMockMonthlySummary>,
    origin: ReservationOrigin
  ) {
    return summary.channelBreakdown.find((row) => row.origin === origin);
  }

  it("moves the reservation from airbnb to booking in the breakdown", () => {
    const before = aggregateMockMonthlySummary(
      [reservation({ approvedAmountClp: 84_000, origin: "airbnb" })],
      rooms,
      range
    );
    expect(amountFor(before, "airbnb")).toMatchObject({
      approvedAmountClp: 84_000,
      reservationCount: 1,
    });
    expect(amountFor(before, "booking")).toMatchObject({
      approvedAmountClp: 0,
      reservationCount: 0,
    });

    const after = aggregateMockMonthlySummary(
      [reservation({ approvedAmountClp: 84_000, origin: "booking" })],
      rooms,
      range
    );
    expect(amountFor(after, "airbnb")).toMatchObject({
      approvedAmountClp: 0,
      reservationCount: 0,
    });
    expect(amountFor(after, "booking")).toMatchObject({
      approvedAmountClp: 84_000,
      reservationCount: 1,
    });
  });

  it("keeps the month's total revenue unchanged by a channel correction", () => {
    const asAirbnb = aggregateMockMonthlySummary(
      [reservation({ approvedAmountClp: 84_000, origin: "airbnb" })],
      rooms,
      range
    );
    const asBooking = aggregateMockMonthlySummary(
      [reservation({ approvedAmountClp: 84_000, origin: "booking" })],
      rooms,
      range
    );
    expect(asBooking.approvedRevenueClp).toBe(asAirbnb.approvedRevenueClp);
  });
});
