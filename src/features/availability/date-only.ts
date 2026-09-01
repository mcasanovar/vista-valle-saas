export const LODGING_TIME_ZONE = "America/Santiago" as const;
export const LODGING_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const MILLISECONDS_PER_DAY = 86_400_000;
const MIN_YEAR = 1;
const MAX_YEAR = 9999;

declare const lodgingDateBrand: unique symbol;

export type LodgingDate = string & {
  readonly [lodgingDateBrand]: "LodgingDate";
};

export type LodgingDateInput = LodgingDate | string;

export type LodgingInterval = Readonly<{
  checkIn: LodgingDate;
  checkOut: LodgingDate;
}>;

export class InvalidLodgingDateError extends RangeError {
  readonly code = "INVALID_LODGING_DATE" as const;

  constructor(value: unknown) {
    super(`Invalid lodging date: ${String(value)}`);
    this.name = "InvalidLodgingDateError";
  }
}

export class InvalidLodgingIntervalError extends RangeError {
  readonly code = "INVALID_LODGING_INTERVAL" as const;

  constructor(checkIn: string, checkOut: string) {
    super(`Check-out must be after check-in: ${checkIn} to ${checkOut}`);
    this.name = "InvalidLodgingIntervalError";
  }
}

function isLeapYear(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function daysInMonth(year: number, month: number) {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

function parseParts(value: unknown) {
  if (typeof value !== "string" || !LODGING_DATE_PATTERN.test(value)) {
    throw new InvalidLodgingDateError(value);
  }

  const [year, month, day] = value.split("-").map(Number);
  if (
    year < MIN_YEAR ||
    year > MAX_YEAR ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    throw new InvalidLodgingDateError(value);
  }

  return { day, month, year };
}

function toUtcEpochDay(value: LodgingDateInput) {
  const { day, month, year } = parseParts(value);
  const utc = new Date(Date.UTC(0, month - 1, day));
  utc.setUTCFullYear(year);
  return Math.floor(utc.getTime() / MILLISECONDS_PER_DAY);
}

function fromUtcEpochDay(epochDay: number): LodgingDate {
  const utc = new Date(epochDay * MILLISECONDS_PER_DAY);
  const year = utc.getUTCFullYear();
  const month = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const day = String(utc.getUTCDate()).padStart(2, "0");
  return parseLodgingDate(`${String(year).padStart(4, "0")}-${month}-${day}`);
}

export function parseLodgingDate(value: string): LodgingDate {
  parseParts(value);
  return value as LodgingDate;
}

export function isValidLodgingDate(value: unknown): value is LodgingDate {
  try {
    parseParts(value);
    return true;
  } catch (error) {
    if (error instanceof InvalidLodgingDateError) return false;
    throw error;
  }
}

export function compareLodgingDates(
  left: LodgingDateInput,
  right: LodgingDateInput
) {
  const leftEpochDay = toUtcEpochDay(left);
  const rightEpochDay = toUtcEpochDay(right);
  return Math.sign(leftEpochDay - rightEpochDay) as -1 | 0 | 1;
}

export function createLodgingInterval(
  checkIn: LodgingDateInput,
  checkOut: LodgingDateInput
): LodgingInterval {
  const parsedCheckIn = parseLodgingDate(checkIn);
  const parsedCheckOut = parseLodgingDate(checkOut);

  if (compareLodgingDates(parsedCheckOut, parsedCheckIn) <= 0) {
    throw new InvalidLodgingIntervalError(parsedCheckIn, parsedCheckOut);
  }

  return Object.freeze({
    checkIn: parsedCheckIn,
    checkOut: parsedCheckOut,
  });
}

export function nights(checkIn: LodgingDateInput, checkOut: LodgingDateInput) {
  const interval = createLodgingInterval(checkIn, checkOut);
  return toUtcEpochDay(interval.checkOut) - toUtcEpochDay(interval.checkIn);
}

export function intervalsOverlap(
  existing: LodgingInterval,
  requested: LodgingInterval
) {
  return (
    compareLodgingDates(existing.checkIn, requested.checkOut) < 0 &&
    compareLodgingDates(existing.checkOut, requested.checkIn) > 0
  );
}

export function addLodgingDays(
  date: LodgingDateInput,
  amount: number
): LodgingDate {
  parseLodgingDate(date);
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError("Lodging day amount must be a safe integer");
  }

  return fromUtcEpochDay(toUtcEpochDay(date) + amount);
}

/** Current calendar day in the lodging time zone, independent of server UTC. */
export function lodgingToday(now: Date = new Date()): LodgingDate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: LODGING_TIME_ZONE,
    year: "numeric",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value;

  return parseLodgingDate(`${part("year")}-${part("month")}-${part("day")}`);
}

/** Minimum dates used to guide and authoritatively validate public searches. */
export function publicAvailabilityDateMinimums(now: Date = new Date()) {
  const checkIn = lodgingToday(now);
  return Object.freeze({ checkIn, checkOut: addLodgingDays(checkIn, 1) });
}

export function formatLodgingDate(date: LodgingDateInput, locale = "es-CL") {
  const parsed = parseLodgingDate(date);
  const { day, month, year } = parseParts(parsed);
  const utcNoon = new Date(Date.UTC(0, month - 1, day, 12));
  utcNoon.setUTCFullYear(year);

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
    timeZone: LODGING_TIME_ZONE,
  }).format(utcNoon);
}
