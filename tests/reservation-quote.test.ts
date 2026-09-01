import { describe, expect, it } from "vitest";

import { createLodgingInterval } from "@/features/availability";
import {
  buildReservationQuote,
  GuestCapacityExceededError,
  InvalidGuestInputError,
} from "@/features/reservations";

const room = Object.freeze({ capacity: 2, nightlyPriceClp: 60_000 });
const interval = createLodgingInterval("2024-05-05", "2024-05-08");

const validGuestCandidate = Object.freeze({
  email: "ana@example.com",
  firstName: "Ana",
  guestCount: 2,
  lastName: "Perez",
  phone: "+56 9 1234 5678",
});

describe("buildReservationQuote", () => {
  it("returns validated guest data and frozen authoritative pricing on the happy path", () => {
    const quote = buildReservationQuote(validGuestCandidate, room, interval, [
      { amountClp: 10_000, label: "Cleaning fee" },
    ]);

    expect(quote.guest.firstName).toBe("Ana");
    expect(quote.guest.guestCount).toBe(2);
    expect(quote.pricing).toEqual({
      chargesClp: 10_000,
      nightlyPriceClp: 60_000,
      nights: 3,
      totalClp: 3 * 60_000 + 10_000,
    });
    expect(Object.isFrozen(quote)).toBe(true);
    expect(Object.isFrozen(quote.pricing)).toBe(true);
  });

  it("defaults to zero charges when none are supplied", () => {
    const quote = buildReservationQuote(validGuestCandidate, room, interval);

    expect(quote.pricing.chargesClp).toBe(0);
    expect(quote.pricing.totalClp).toBe(3 * 60_000);
  });

  it("validates guest input before checking capacity", () => {
    const invalidGuestOverCapacity = {
      ...validGuestCandidate,
      firstName: "",
      guestCount: 5,
    };

    expect(() =>
      buildReservationQuote(invalidGuestOverCapacity, room, interval)
    ).toThrow(InvalidGuestInputError);
  });

  it("rejects a guestCount above the room capacity with a capacity error", () => {
    expect(() =>
      buildReservationQuote(
        { ...validGuestCandidate, guestCount: 3 },
        room,
        interval
      )
    ).toThrow(GuestCapacityExceededError);
  });

  it("never lets a client-supplied total influence the quote", () => {
    const manipulatedGuestCandidate = {
      ...validGuestCandidate,
      totalClp: 1,
    };

    const quote = buildReservationQuote(
      manipulatedGuestCandidate,
      room,
      interval
    );

    expect(quote.pricing.totalClp).toBe(3 * 60_000);
  });
});
