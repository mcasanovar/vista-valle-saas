import { describe, expect, it } from "vitest";

import { createLodgingInterval } from "@/features/availability";
import {
  computeMultiRoomReservationPricing,
  manualNightlyPricesOf,
  recalculateReservationStayPricing,
  type ReservationItemRecord,
  type ReservationStayRoomRate,
} from "@/features/reservations";

function buildRate(
  overrides: Partial<ReservationStayRoomRate> = {}
): ReservationStayRoomRate {
  return Object.freeze({
    capacity: 4,
    id: "room-1",
    nightlyPriceClp: 50_000,
    occupancyPrices: [],
    ...overrides,
  });
}

function buildItem(
  overrides: Partial<ReservationItemRecord> = {}
): ReservationItemRecord {
  return Object.freeze({
    chargesClp: 0,
    guestCount: 2,
    nightlyPriceClp: 50_000,
    nightlyPriceManual: false,
    nights: 3,
    roomId: "room-1",
    subtotalClp: 150_000,
    ...overrides,
  });
}

describe("manualNightlyPricesOf (task 2.2)", () => {
  it("collects only the lines flagged as hand-set", () => {
    const manual = manualNightlyPricesOf({
      items: [
        buildItem({
          nightlyPriceClp: 42_000,
          nightlyPriceManual: true,
          roomId: "room-1",
        }),
        buildItem({
          nightlyPriceClp: 50_000,
          nightlyPriceManual: false,
          roomId: "room-2",
        }),
      ],
    });

    expect([...manual.entries()]).toEqual([["room-1", 42_000]]);
  });

  it("returns an empty map for a reservation with no hand-set value", () => {
    expect(manualNightlyPricesOf({ items: [buildItem()] }).size).toBe(0);
  });
});

describe("stay pricing with a hand-set nightly value (task 2.2)", () => {
  it("keeps the hand-set value instead of the room's current rate when dates change", () => {
    const interval = createLodgingInterval("2026-11-01", "2026-11-05");
    const result = recalculateReservationStayPricing(
      interval,
      [{ guestCount: 2, roomId: "room-1" }],
      new Map([["room-1", buildRate({ nightlyPriceClp: 60_000 })]]),
      new Map(),
      new Map([["room-1", 42_000]])
    );

    expect(result.items[0]).toMatchObject({
      nightlyPriceClp: 42_000,
      nightlyPriceManual: true,
      nights: 4,
      roomId: "room-1",
      totalClp: 168_000,
    });
    expect(result.totalClp).toBe(168_000);
  });

  it("keeps the hand-set value when only the occupancy changes", () => {
    const interval = createLodgingInterval("2026-11-01", "2026-11-04");
    const rates = new Map([
      [
        "room-1",
        buildRate({
          nightlyPriceClp: 50_000,
          occupancyPrices: [{ occupancy: 1, priceClp: 35_000 }],
        }),
      ],
    ]);

    const withoutManual = recalculateReservationStayPricing(
      interval,
      [{ guestCount: 1, roomId: "room-1" }],
      rates
    );
    expect(withoutManual.items[0]?.nightlyPriceClp).toBe(35_000);
    expect(withoutManual.items[0]?.nightlyPriceManual).toBe(false);

    const withManual = recalculateReservationStayPricing(
      interval,
      [{ guestCount: 1, roomId: "room-1" }],
      rates,
      new Map(),
      new Map([["room-1", 42_000]])
    );
    expect(withManual.items[0]?.nightlyPriceClp).toBe(42_000);
    expect(withManual.items[0]?.nightlyPriceManual).toBe(true);
    expect(withManual.totalClp).toBe(126_000);
  });

  it("prices a newly added room from the current rate while the existing room keeps its hand-set value", () => {
    const interval = createLodgingInterval("2026-11-01", "2026-11-03");
    const result = recalculateReservationStayPricing(
      interval,
      [
        { guestCount: 2, roomId: "room-1" },
        { guestCount: 2, roomId: "room-2" },
      ],
      new Map([
        ["room-1", buildRate({ id: "room-1", nightlyPriceClp: 60_000 })],
        ["room-2", buildRate({ id: "room-2", nightlyPriceClp: 70_000 })],
      ]),
      new Map(),
      // Only the preexisting room carries a hand-set value; the added room
      // never appears in this map.
      new Map([["room-1", 42_000]])
    );

    const byRoom = new Map(result.items.map((item) => [item.roomId, item]));
    expect(byRoom.get("room-1")).toMatchObject({
      nightlyPriceClp: 42_000,
      nightlyPriceManual: true,
      totalClp: 84_000,
    });
    expect(byRoom.get("room-2")).toMatchObject({
      nightlyPriceClp: 70_000,
      nightlyPriceManual: false,
      totalClp: 140_000,
    });
    expect(result.totalClp).toBe(224_000);
  });

  it("re-resolves the current rate once the hand-set value is dropped", () => {
    const interval = createLodgingInterval("2026-11-01", "2026-11-03");
    const result = recalculateReservationStayPricing(
      interval,
      [{ guestCount: 2, roomId: "room-1" }],
      new Map([["room-1", buildRate({ nightlyPriceClp: 60_000 })]]),
      new Map(),
      new Map()
    );

    expect(result.items[0]?.nightlyPriceClp).toBe(60_000);
    expect(result.items[0]?.nightlyPriceManual).toBe(false);
  });
});

describe("the total stays derived from the nightly value (task 2.3)", () => {
  it("derives totalClp as nights * manual value + charges, never from a caller total", () => {
    const interval = createLodgingInterval("2026-11-01", "2026-11-06");
    const result = computeMultiRoomReservationPricing(
      interval,
      [
        {
          guestCount: 2,
          id: "room-1",
          nightlyPriceClp: 37_000,
          nightlyPriceManual: true,
        },
      ],
      new Map([["room-1", [{ amountClp: 5_000, label: "Aseo" }]]])
    );

    // 5 nights * 37.000 + 5.000 of charges.
    expect(result.items[0]).toMatchObject({
      chargesClp: 5_000,
      nightlyPriceClp: 37_000,
      nightlyPriceManual: true,
      nights: 5,
      totalClp: 190_000,
    });
    expect(result.totalClp).toBe(190_000);
  });

  it("defaults the provenance flag to false when the caller omits it", () => {
    const result = computeMultiRoomReservationPricing(
      createLodgingInterval("2026-11-01", "2026-11-02"),
      [{ guestCount: 1, id: "room-1", nightlyPriceClp: 30_000 }]
    );

    expect(result.items[0]?.nightlyPriceManual).toBe(false);
    expect(result.totalClp).toBe(30_000);
  });
});
