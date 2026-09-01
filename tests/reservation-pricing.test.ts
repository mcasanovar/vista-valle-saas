import { describe, expect, it } from "vitest";

import { createLodgingInterval } from "@/features/availability";
import {
  computeReservationPricing,
  InvalidPricingInputError,
} from "@/features/reservations";

describe("authoritative reservation pricing", () => {
  it("computes 3 nights with no charges", () => {
    const interval = createLodgingInterval("2024-05-05", "2024-05-08");

    const pricing = computeReservationPricing(interval, 50_000);

    expect(pricing.nights).toBe(3);
    expect(pricing.nightlyPriceClp).toBe(50_000);
    expect(pricing.chargesClp).toBe(0);
    expect(pricing.totalClp).toBe(3 * 50_000);
    expect(Object.isFrozen(pricing)).toBe(true);
  });

  it("includes applicable charges in the frozen total", () => {
    const interval = createLodgingInterval("2024-05-05", "2024-05-08");

    const pricing = computeReservationPricing(interval, 50_000, [
      { amountClp: 15_000, label: "Cleaning fee" },
      { amountClp: 5_000, label: "Late checkout" },
    ]);

    expect(pricing.chargesClp).toBe(20_000);
    expect(pricing.totalClp).toBe(3 * 50_000 + 20_000);
  });

  it("rejects a negative or non-integer nightly price", () => {
    const interval = createLodgingInterval("2024-05-05", "2024-05-08");

    expect(() => computeReservationPricing(interval, -1)).toThrow(
      InvalidPricingInputError
    );
    expect(() => computeReservationPricing(interval, 10.5)).toThrow(
      InvalidPricingInputError
    );
  });

  it("rejects a negative charge amount", () => {
    const interval = createLodgingInterval("2024-05-05", "2024-05-08");

    expect(() =>
      computeReservationPricing(interval, 50_000, [
        { amountClp: -1, label: "Invalid" },
      ])
    ).toThrow(InvalidPricingInputError);
  });

  it("never accepts or is influenced by a client-supplied total", () => {
    const interval = createLodgingInterval("2024-05-05", "2024-05-08");

    // computeReservationPricing has no "total" parameter in its signature,
    // so simulate a manipulated payload the way an untyped call site (e.g.
    // JSON parsed from a request body) might produce, and confirm the
    // extra field is simply ignored because it is never read.
    const manipulatedInterval = {
      ...interval,
      totalClp: 1,
    } as typeof interval & { totalClp: number };
    const manipulatedCharges = [
      { amountClp: 5_000, label: "Cleaning fee", totalClp: 1 },
    ] as { amountClp: number; label: string; totalClp: number }[];

    const authoritative = computeReservationPricing(interval, 50_000, [
      { amountClp: 5_000, label: "Cleaning fee" },
    ]);
    const manipulated = computeReservationPricing(
      manipulatedInterval,
      50_000,
      manipulatedCharges
    );

    expect(manipulated.totalClp).toBe(authoritative.totalClp);
    expect(manipulated.totalClp).toBe(3 * 50_000 + 5_000);
    expect(manipulated.totalClp).not.toBe(1);
  });
});
