import { describe, expect, it } from "vitest";

import { validateManualReservationDateRange } from "@/features/admin/manual-reservation-contract";

/**
 * The administrative creation flow deliberately does not apply the public
 * search's current-date rule (`admin-manual-reservations` spec "Registro de
 * estadías ya iniciadas o pasadas"). These cases pin that down so the rule
 * cannot drift back in.
 */
describe("manual reservation date range", () => {
  it("accepts a check-in before today, for a stay already under way", () => {
    expect(
      validateManualReservationDateRange("2020-03-14", "2099-03-16")
    ).toEqual([]);
  });

  it("accepts a stay whose check-in and check-out both already passed", () => {
    expect(
      validateManualReservationDateRange("2020-03-14", "2020-03-16")
    ).toEqual([]);
  });

  it("rejects a check-out that precedes the check-in", () => {
    expect(
      validateManualReservationDateRange("2020-03-16", "2020-03-14")
    ).toEqual([
      {
        field: "checkOut",
        message: "La fecha de salida debe ser posterior a la de entrada.",
      },
    ]);
  });

  it("rejects a check-out on the same day as the check-in", () => {
    expect(
      validateManualReservationDateRange("2020-03-14", "2020-03-14")
    ).toEqual([
      {
        field: "checkOut",
        message: "La fecha de salida debe ser posterior a la de entrada.",
      },
    ]);
  });

  it("reports nothing for missing dates, left to required-field validation", () => {
    expect(validateManualReservationDateRange("", "")).toEqual([]);
    expect(validateManualReservationDateRange("2020-03-14", "")).toEqual([]);
    expect(validateManualReservationDateRange("", "2020-03-16")).toEqual([]);
  });

  it("reports nothing for malformed dates, left to domain interval validation", () => {
    expect(validateManualReservationDateRange("not-a-date", "2020-03-16")).toEqual(
      []
    );
    expect(validateManualReservationDateRange("2020-03-14", "nope")).toEqual([]);
  });
});
