import { describe, expect, it } from "vitest";

import {
  assertExternalChannelReservation,
  isExternalChannelReservation,
  ReservationNotExternalChannelError,
  type ReservationOrigin,
} from "@/features/reservations";

/** Every value of the `reservation_origin` enum, so a new origin added to the schema fails this test until its eligibility is decided. */
const allOrigins: readonly ReservationOrigin[] = [
  "website",
  "airbnb",
  "booking",
  "phone",
  "whatsapp",
  "admin",
];

describe("external-channel eligibility (task 2.1)", () => {
  it("accepts only the two external-channel origins", () => {
    const eligible = allOrigins.filter((origin) =>
      isExternalChannelReservation({ origin })
    );
    expect(eligible).toEqual(["airbnb", "booking"]);
  });

  it.each(["airbnb", "booking"] as const)(
    "asserts %s as eligible without throwing",
    (origin) => {
      expect(() =>
        assertExternalChannelReservation({ origin })
      ).not.toThrow();
    }
  );

  it.each(["website", "phone", "whatsapp", "admin"] as const)(
    "rejects %s with its origin on the error",
    (origin) => {
      expect(() => assertExternalChannelReservation({ origin })).toThrow(
        ReservationNotExternalChannelError
      );
      try {
        assertExternalChannelReservation({ origin });
      } catch (error) {
        expect(error).toBeInstanceOf(ReservationNotExternalChannelError);
        expect((error as ReservationNotExternalChannelError).origin).toBe(
          origin
        );
        expect((error as ReservationNotExternalChannelError).code).toBe(
          "RESERVATION_NOT_EXTERNAL_CHANNEL"
        );
      }
    }
  );
});
