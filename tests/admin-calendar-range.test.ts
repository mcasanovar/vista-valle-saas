import { describe, expect, it } from "vitest";
import { parseLodgingDate } from "@/features/availability";
import {
  calendarRangeForAnchor,
  defaultCalendarRange,
  nextCalendarRange,
  parseCalendarRangePreset,
  previousCalendarRange,
  weekBucketsWithin,
} from "@/features/admin/calendar-range";

describe("calendar-range", () => {
  it("defaults to the Mes preset centered on the current month", () => {
    const now = new Date("2026-09-15T12:00:00Z");
    const range = defaultCalendarRange(now);
    expect(range).toMatchObject({
      checkIn: "2026-09-01",
      checkOut: "2026-10-01",
      preset: "month",
    });
  });

  it("resolves week/two_weeks to a Monday-start range", () => {
    const anchor = parseLodgingDate("2026-09-17");
    expect(calendarRangeForAnchor("week", anchor)).toMatchObject({
      checkIn: "2026-09-14",
      checkOut: "2026-09-21",
    });
    expect(calendarRangeForAnchor("two_weeks", anchor)).toMatchObject({
      checkIn: "2026-09-14",
      checkOut: "2026-09-28",
    });
  });

  it("resolves next_7_days as a rolling window starting on the anchor", () => {
    const anchor = parseLodgingDate("2026-09-17");
    expect(calendarRangeForAnchor("next_7_days", anchor)).toMatchObject({
      checkIn: "2026-09-17",
      checkOut: "2026-09-24",
    });
  });

  it("navigates month ranges across year boundaries", () => {
    const december = calendarRangeForAnchor(
      "month",
      parseLodgingDate("2026-12-10")
    );
    expect(nextCalendarRange(december)).toMatchObject({
      checkIn: "2027-01-01",
      checkOut: "2027-02-01",
    });
    expect(previousCalendarRange(december)).toMatchObject({
      checkIn: "2026-11-01",
      checkOut: "2026-12-01",
    });
  });

  it("falls back to Mes for an unknown preset", () => {
    expect(parseCalendarRangePreset("bogus")).toBe("month");
    expect(parseCalendarRangePreset(undefined)).toBe("month");
    expect(parseCalendarRangePreset("week")).toBe("week");
  });

  it("builds Monday-start week buckets covering a month", () => {
    const month = calendarRangeForAnchor("month", parseLodgingDate("2026-02-10"));
    const buckets = weekBucketsWithin(month);
    expect(buckets[0]).toMatchObject({ checkIn: "2026-01-26" });
    expect(buckets.at(-1)).toMatchObject({ checkOut: "2026-03-02" });
    for (let index = 1; index < buckets.length; index += 1) {
      expect(buckets[index]!.checkIn).toBe(buckets[index - 1]!.checkOut);
    }
  });
});
