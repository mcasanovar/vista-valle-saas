import { describe, expect, it } from "vitest";

import {
  assertManualNightlyRateAllowed,
  ManualNightlyRateNotAllowedError,
  reservationAllowsManualNightlyRate,
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

describe("nightly-value eligibility by origin", () => {
  it("accepts exactly the origins whose price comes from an outside agreement", () => {
    const eligible = allOrigins.filter((origin) =>
      reservationAllowsManualNightlyRate({ origin })
    );
    expect(eligible).toEqual(["airbnb", "booking", "whatsapp"]);
  });

  it.each(["airbnb", "booking", "whatsapp"] as const)(
    "asserts %s as eligible without throwing",
    (origin) => {
      expect(() => assertManualNightlyRateAllowed({ origin })).not.toThrow();
    }
  );

  it.each(["website", "phone", "admin"] as const)(
    "rejects %s with its origin on the error",
    (origin) => {
      expect(() => assertManualNightlyRateAllowed({ origin })).toThrow(
        ManualNightlyRateNotAllowedError
      );
      try {
        assertManualNightlyRateAllowed({ origin });
      } catch (error) {
        expect(error).toBeInstanceOf(ManualNightlyRateNotAllowedError);
        expect((error as ManualNightlyRateNotAllowedError).origin).toBe(origin);
        expect((error as ManualNightlyRateNotAllowedError).code).toBe(
          "MANUAL_NIGHTLY_RATE_NOT_ALLOWED"
        );
      }
    }
  );
});
