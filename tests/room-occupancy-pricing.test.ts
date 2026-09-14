import { describe, expect, it } from "vitest";

import {
  InvalidOccupancyError,
  resolveRoomNightlyPrice,
} from "@/features/rooms";

describe("resolveRoomNightlyPrice", () => {
  it("returns the tier price for a room with differentiated occupancy prices", () => {
    const room = { capacity: 2, nightlyPriceClp: 70_000 };
    const occupancyPrices = [
      { occupancy: 1, priceClp: 55_000 },
      { occupancy: 2, priceClp: 70_000 },
    ];

    expect(resolveRoomNightlyPrice(room, occupancyPrices, 1)).toBe(55_000);
    expect(resolveRoomNightlyPrice(room, occupancyPrices, 2)).toBe(70_000);
  });

  it("returns the same fixed price for both occupancies when configured equal", () => {
    const room = { capacity: 2, nightlyPriceClp: 75_000 };
    const occupancyPrices = [
      { occupancy: 1, priceClp: 75_000 },
      { occupancy: 2, priceClp: 75_000 },
    ];

    expect(resolveRoomNightlyPrice(room, occupancyPrices, 1)).toBe(75_000);
    expect(resolveRoomNightlyPrice(room, occupancyPrices, 2)).toBe(75_000);
  });

  it("falls back to the room's base nightly price when no occupancy prices are configured", () => {
    const room = { capacity: 2, nightlyPriceClp: 45_000 };

    expect(resolveRoomNightlyPrice(room, [], 1)).toBe(45_000);
    expect(resolveRoomNightlyPrice(room, [], 2)).toBe(45_000);
  });

  it("falls back to the base price for an occupancy without a configured row", () => {
    const room = { capacity: 2, nightlyPriceClp: 45_000 };
    const occupancyPrices = [{ occupancy: 1, priceClp: 55_000 }];

    expect(resolveRoomNightlyPrice(room, occupancyPrices, 2)).toBe(45_000);
  });

  it("rejects an occupancy below 1 or above the room's capacity", () => {
    const room = { capacity: 2, nightlyPriceClp: 45_000 };

    expect(() => resolveRoomNightlyPrice(room, [], 0)).toThrow(
      InvalidOccupancyError
    );
    expect(() => resolveRoomNightlyPrice(room, [], 3)).toThrow(
      InvalidOccupancyError
    );
  });
});
