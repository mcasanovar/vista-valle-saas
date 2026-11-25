// eslint-disable-next-line architecture/feature-public-api -- shared with a Client Component, so it uses the browser-safe date contract.
import { compareLodgingDates } from "@/features/availability/client-date-only";

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
 * Validates a manual reservation's dates against the only date rule the
 * administrative creation flow has: departure must come after entry.
 *
 * Deliberately **not** derived from `publicAvailabilityDateMinimums`, which
 * it used to delegate to. That minimum-date rule exists so a visitor cannot
 * search availability in dates that already passed; an administrator
 * registering a stay that began yesterday - or one that already ended - is
 * the case this flow exists for (`admin-manual-reservations` spec "Registro
 * de estadías ya iniciadas o pasadas").
 *
 * Reducing the rule rather than gating it behind a flag is the point, and
 * mirrors what `./stay-edit-availability.ts` documents for the stay edit: a
 * flag that relaxes a public rule is easy to switch on by mistake from the
 * public flow, while a contract that no longer expresses a current-date rule
 * cannot leak one. The public search keeps its own rule in
 * `src/features/availability/search.ts` and `results-query.ts`, neither of
 * which reads this module.
 *
 * Only checks well-formed, non-empty dates; malformed or missing values are
 * reported by the caller's own required-field validation and by the domain's
 * interval validation.
 */
export function validateManualReservationDateRange(
  checkIn: string,
  checkOut: string
): readonly ManualReservationDateFieldError[] {
  if (!checkIn || !checkOut) return [];
  try {
    if (compareLodgingDates(checkOut, checkIn) <= 0) {
      return [
        {
          field: "checkOut",
          message: "La fecha de salida debe ser posterior a la de entrada.",
        },
      ];
    }
  } catch {
    // Malformed dates are reported by domain interval validation instead.
  }
  return [];
}
