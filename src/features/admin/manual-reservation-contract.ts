// eslint-disable-next-line architecture/feature-public-api -- shared with a Client Component, so it uses the browser-safe date contract.
import {
  compareLodgingDates,
  publicAvailabilityDateMinimums,
} from "@/features/availability/client-date-only";

export const manualOrigins = [
  "airbnb",
  "booking",
  "phone",
  "whatsapp",
  "admin",
] as const;

export type ManualOrigin = (typeof manualOrigins)[number];

export type ManualReservationDateField = "checkIn" | "checkOut";

export type ManualReservationDateFieldError = Readonly<{
  field: ManualReservationDateField;
  message: string;
}>;

/**
 * Same minimum-date rule enforced on the public availability search: entry
 * cannot be before today, and departure cannot be before tomorrow.
 */
export function manualReservationDateMinimums(now: Date = new Date()) {
  return publicAvailabilityDateMinimums(now);
}

/**
 * Validates a manual reservation's dates against the public booking
 * minimums. Only checks well-formed, non-empty dates; malformed or missing
 * values are reported by the caller's own required-field validation.
 */
export function validateManualReservationDateRange(
  checkIn: string,
  checkOut: string,
  now: Date = new Date()
): readonly ManualReservationDateFieldError[] {
  if (!checkIn || !checkOut) return [];
  const minimums = manualReservationDateMinimums(now);
  const errors: ManualReservationDateFieldError[] = [];
  try {
    if (compareLodgingDates(checkIn, minimums.checkIn) < 0) {
      errors.push({
        field: "checkIn",
        message: "La fecha de entrada no puede ser anterior a hoy.",
      });
    }
  } catch {
    // Malformed dates are reported by domain interval validation instead.
  }
  try {
    if (compareLodgingDates(checkOut, minimums.checkOut) < 0) {
      errors.push({
        field: "checkOut",
        message: "La fecha de salida debe ser como mínimo mañana.",
      });
    }
  } catch {
    // Malformed dates are reported by domain interval validation instead.
  }
  return errors;
}
