import { describe, expect, it } from "vitest";

import {
  addLodgingDays,
  compareLodgingDates,
  createLodgingInterval,
  formatLodgingDate,
  InvalidLodgingDateError,
  InvalidLodgingIntervalError,
  intervalsOverlap,
  isValidLodgingDate,
  LODGING_TIME_ZONE,
  lodgingToday,
  nights,
  parseLodgingDate,
  publicAvailabilityDateMinimums,
} from "@/features/availability";

describe("America/Santiago lodging dates", () => {
  it("derives public date minimums in Santiago across a UTC date boundary", () => {
    const now = new Date("2030-01-10T02:30:00.000Z");
    expect(lodgingToday(now)).toBe("2030-01-09");
    expect(publicAvailabilityDateMinimums(now)).toEqual({
      checkIn: "2030-01-09",
      checkOut: "2030-01-10",
    });
  });

  it("uses strict Gregorian YYYY-MM-DD calendar values", () => {
    expect(LODGING_TIME_ZONE).toBe("America/Santiago");
    expect(parseLodgingDate("2024-02-29")).toBe("2024-02-29");
    expect(isValidLodgingDate("2024-02-29")).toBe(true);
    expect(isValidLodgingDate("2023-02-29")).toBe(false);
    expect(isValidLodgingDate("2024-04-31")).toBe(false);

    for (const value of [
      "2024-2-09",
      "2024-02-9",
      "2024/02/09",
      "2024-02-09T00:00:00.000Z",
      "0000-01-01",
      "10000-01-01",
    ]) {
      expect(() => parseLodgingDate(value)).toThrow(InvalidLodgingDateError);
    }

    expect(() =>
      parseLodgingDate(new Date("2024-02-09") as unknown as string)
    ).toThrow(InvalidLodgingDateError);
  });

  it("rejects non-positive lodging intervals with a domain error", () => {
    expect(() => createLodgingInterval("2024-05-05", "2024-05-05")).toThrow(
      InvalidLodgingIntervalError
    );
    expect(() => createLodgingInterval("2024-05-06", "2024-05-05")).toThrow(
      InvalidLodgingIntervalError
    );
    expect(() => nights("2024-05-06", "2024-05-05")).toThrow(
      InvalidLodgingIntervalError
    );
  });

  it("calculates calendar nights across leap dates and Santiago DST transitions", () => {
    expect(nights("2024-02-28", "2024-03-01")).toBe(2);
    expect(nights("2024-09-07", "2024-09-09")).toBe(2);
    expect(nights("2025-04-05", "2025-04-07")).toBe(2);
    expect(addLodgingDays("2024-09-07", 2)).toBe("2024-09-09");
    expect(addLodgingDays("2024-02-28", 2)).toBe("2024-03-01");
  });

  it("compares and formats calendar values without time-of-day drift", () => {
    expect(compareLodgingDates("2024-05-05", "2024-05-06")).toBe(-1);
    expect(compareLodgingDates("2024-05-06", "2024-05-06")).toBe(0);
    expect(compareLodgingDates("2024-05-07", "2024-05-06")).toBe(1);
    expect(formatLodgingDate("2024-05-05")).toMatch(/5 de mayo de 2024/);
  });
});

describe("half-open lodging intervals", () => {
  it("does not overlap same-day turnover or adjacent intervals", () => {
    const departing = createLodgingInterval("2024-05-05", "2024-05-08");
    const arriving = createLodgingInterval("2024-05-08", "2024-05-10");
    const before = createLodgingInterval("2024-05-01", "2024-05-05");

    expect(intervalsOverlap(departing, arriving)).toBe(false);
    expect(intervalsOverlap(departing, before)).toBe(false);
  });

  it("detects partial and containing overlaps using half-open boundaries", () => {
    const existing = createLodgingInterval("2024-05-05", "2024-05-10");

    expect(
      intervalsOverlap(
        existing,
        createLodgingInterval("2024-05-04", "2024-05-06")
      )
    ).toBe(true);
    expect(
      intervalsOverlap(
        existing,
        createLodgingInterval("2024-05-06", "2024-05-08")
      )
    ).toBe(true);
    expect(
      intervalsOverlap(
        existing,
        createLodgingInterval("2024-05-01", "2024-05-12")
      )
    ).toBe(true);
  });
});
