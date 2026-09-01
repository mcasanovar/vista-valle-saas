// eslint-disable-next-line architecture/feature-public-api -- this client-safe date utility avoids the server-only availability barrel.
import {
  addLodgingDays,
  lodgingToday,
  parseLodgingDate,
  type LodgingDate,
} from "@/features/availability/client-date-only";

export const calendarRangePresets = [
  "week",
  "two_weeks",
  "next_7_days",
  "month",
] as const;
export type CalendarRangePreset = (typeof calendarRangePresets)[number];
/** Mes es el rango más usado (ver proposal.md/design.md). */
export const DEFAULT_CALENDAR_RANGE_PRESET: CalendarRangePreset = "month";

export type CalendarGranularity = "daily" | "weekly";
export const DEFAULT_CALENDAR_GRANULARITY: CalendarGranularity = "daily";

export type CalendarRange = Readonly<{
  preset: CalendarRangePreset;
  /** Inclusive. */
  checkIn: LodgingDate;
  /** Exclusive - the first day after the visible range. */
  checkOut: LodgingDate;
}>;

function datePartsOf(date: LodgingDate) {
  const [year, month, day] = date.split("-").map(Number);
  return { day, month, year } as const;
}

/** Monday-start week containing `date`. */
function startOfWeek(date: LodgingDate): LodgingDate {
  const { day, month, year } = datePartsOf(date);
  const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysSinceMonday = (dayOfWeek + 6) % 7;
  return addLodgingDays(date, -daysSinceMonday);
}

function startOfMonth(date: LodgingDate): LodgingDate {
  const { month, year } = datePartsOf(date);
  return parseLodgingDate(
    `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-01`
  );
}

export function addCalendarMonths(
  date: LodgingDate,
  amount: number
): LodgingDate {
  const { day, month, year } = datePartsOf(date);
  const totalMonths = year * 12 + (month - 1) + amount;
  const newYear = Math.floor(totalMonths / 12);
  const newMonthIndex = totalMonths - newYear * 12;
  const daysInNewMonth = new Date(
    Date.UTC(newYear, newMonthIndex + 1, 0)
  ).getUTCDate();
  const clampedDay = Math.min(day, daysInNewMonth);
  return parseLodgingDate(
    `${String(newYear).padStart(4, "0")}-${String(newMonthIndex + 1).padStart(2, "0")}-${String(clampedDay).padStart(2, "0")}`
  );
}

export function calendarRangeForAnchor(
  preset: CalendarRangePreset,
  anchor: LodgingDate
): CalendarRange {
  switch (preset) {
    case "week": {
      const checkIn = startOfWeek(anchor);
      return Object.freeze({
        checkIn,
        checkOut: addLodgingDays(checkIn, 7),
        preset,
      });
    }
    case "two_weeks": {
      const checkIn = startOfWeek(anchor);
      return Object.freeze({
        checkIn,
        checkOut: addLodgingDays(checkIn, 14),
        preset,
      });
    }
    case "next_7_days":
      return Object.freeze({
        checkIn: anchor,
        checkOut: addLodgingDays(anchor, 7),
        preset,
      });
    case "month": {
      const checkIn = startOfMonth(anchor);
      return Object.freeze({
        checkIn,
        checkOut: startOfMonth(addCalendarMonths(checkIn, 1)),
        preset,
      });
    }
  }
}

export function defaultCalendarRange(now: Date = new Date()): CalendarRange {
  return calendarRangeForAnchor(DEFAULT_CALENDAR_RANGE_PRESET, lodgingToday(now));
}

export function todayCalendarRange(
  preset: CalendarRangePreset,
  now: Date = new Date()
): CalendarRange {
  return calendarRangeForAnchor(preset, lodgingToday(now));
}

/** Advances the range forward by its own span, preserving the preset. */
export function nextCalendarRange(range: CalendarRange): CalendarRange {
  if (range.preset === "month")
    return calendarRangeForAnchor("month", addCalendarMonths(range.checkIn, 1));
  return calendarRangeForAnchor(range.preset, range.checkOut);
}

/** Moves the range backward by its own span, preserving the preset. */
export function previousCalendarRange(range: CalendarRange): CalendarRange {
  if (range.preset === "month")
    return calendarRangeForAnchor("month", addCalendarMonths(range.checkIn, -1));
  const spanDays: Record<Exclude<CalendarRangePreset, "month">, number> = {
    next_7_days: 7,
    two_weeks: 14,
    week: 7,
  };
  return calendarRangeForAnchor(
    range.preset,
    addLodgingDays(
      range.checkIn,
      -spanDays[range.preset as Exclude<CalendarRangePreset, "month">]
    )
  );
}

export function parseCalendarRangePreset(
  value: string | undefined
): CalendarRangePreset {
  return (calendarRangePresets as readonly string[]).includes(value ?? "")
    ? (value as CalendarRangePreset)
    : DEFAULT_CALENDAR_RANGE_PRESET;
}

export function parseCalendarGranularity(
  value: string | undefined
): CalendarGranularity {
  return value === "weekly" ? "weekly" : DEFAULT_CALENDAR_GRANULARITY;
}

/** Monday-start week buckets covering `range`, for the Mes/semanal comprimida toggle (task 5.3) and the classic calendar grid (task 9.1). */
export function weekBucketsWithin(
  range: CalendarRange
): readonly Readonly<{ checkIn: LodgingDate; checkOut: LodgingDate }>[] {
  const buckets: Readonly<{ checkIn: LodgingDate; checkOut: LodgingDate }>[] =
    [];
  let cursor = startOfWeek(range.checkIn);
  while (cursor < range.checkOut) {
    const checkOut = addLodgingDays(cursor, 7);
    buckets.push(Object.freeze({ checkIn: cursor, checkOut }));
    cursor = checkOut;
  }
  return Object.freeze(buckets);
}

/**
 * The data window the classic calendar grid needs (task 9.1): `range`
 * padded out to full Monday-start weeks. Week/2-semanas ranges are already
 * week-aligned so this equals `range` unchanged; Mes rarely starts on a
 * Monday, so its first/last week bucket spills into the adjacent month -
 * those spillover days are still rendered (dimmed) in the grid and need
 * real occupancy data, not an empty query result.
 */
export function classicGridQueryWindow(
  range: CalendarRange
): Readonly<{ checkIn: LodgingDate; checkOut: LodgingDate }> {
  const buckets = weekBucketsWithin(range);
  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  if (!first || !last) return { checkIn: range.checkIn, checkOut: range.checkOut };
  return Object.freeze({ checkIn: first.checkIn, checkOut: last.checkOut });
}
