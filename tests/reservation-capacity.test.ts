import { describe, expect, it } from "vitest";

import {
  assertGuestCountWithinCapacity,
  GuestCapacityExceededError,
} from "@/features/reservations";

describe("room capacity validation", () => {
  it("passes when guestCount does not exceed capacity", () => {
    expect(() => assertGuestCountWithinCapacity(2, 4)).not.toThrow();
    expect(() => assertGuestCountWithinCapacity(4, 4)).not.toThrow();
  });

  it("throws a domain error explaining the capacity restriction when exceeded", () => {
    expect(() => assertGuestCountWithinCapacity(5, 4)).toThrow(
      GuestCapacityExceededError
    );

    try {
      assertGuestCountWithinCapacity(5, 4);
      throw new Error("expected assertGuestCountWithinCapacity to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(GuestCapacityExceededError);
      const capacityError = error as GuestCapacityExceededError;
      expect(capacityError.code).toBe("GUEST_CAPACITY_EXCEEDED");
      expect(capacityError.attemptedGuestCount).toBe(5);
      expect(capacityError.roomCapacity).toBe(4);
      expect(capacityError.message).toMatch(/capacity/i);
    }
  });

  it("rejects non-positive or non-integer guest counts and capacities", () => {
    expect(() => assertGuestCountWithinCapacity(0, 4)).toThrow(RangeError);
    expect(() => assertGuestCountWithinCapacity(-1, 4)).toThrow(RangeError);
    expect(() => assertGuestCountWithinCapacity(1.5, 4)).toThrow(RangeError);
    expect(() => assertGuestCountWithinCapacity(2, 0)).toThrow(RangeError);
  });
});
