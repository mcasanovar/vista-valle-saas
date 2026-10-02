// eslint-disable-next-line architecture/feature-public-api -- type-only import, erased at compile time; the public reservations barrel reaches server-only data access and this module is browser-safe.
import type { ReservationNightlyRateOverride } from "@/features/reservations/edit-reservation-nightly-rates";

/**
 * Reads one submitted amount as whole CLP. Browser-safe on purpose: the
 * manual-reservation form, its server action and the nightly-value edit
 * action all parse the same way, so a value the form accepts is never
 * re-read differently on the server.
 *
 * CLP has no decimal part, so a `.` is always a thousands separator -
 * reading `42.000` with `Number()` would yield `42`. Only a plain run of
 * digits or a correctly grouped Chilean amount is accepted, after dropping
 * the currency symbol and whitespace; anything else (`42,5`, `4.2`, `abc`)
 * returns `NaN` so the domain rejects it with its own reason instead of a
 * silently wrong value.
 */
export function parseNightlyRateAmount(raw: string): number {
  const compact = raw.replace(/[\s$ ]/g, "");
  if (/^\d+$/.test(compact)) return Number(compact);
  if (/^\d{1,3}(\.\d{3})+$/.test(compact))
    return Number(compact.replace(/\./g, ""));
  return Number.NaN;
}

/** Whether a submitted nightly value is usable: a positive whole amount of CLP. */
export function isValidNightlyRateAmount(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

/**
 * Parses the submitted per-room nightly values. Each room arrives as a
 * `rate:<roomId>` field; an empty value means "drop the hand-set value and go
 * back to the room's current rate". A malformed value is passed through as
 * `NaN` so the domain rejects it rather than being read as a drop.
 *
 * Lives here rather than in the server action because a `"use server"` module
 * may only export async functions.
 */
export function parseNightlyRateOverrides(
  formData: FormData
): readonly ReservationNightlyRateOverride[] {
  const overrides: ReservationNightlyRateOverride[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("rate:")) continue;
    const roomId = key.slice("rate:".length);
    if (!roomId) continue;
    const raw = String(value).trim();
    overrides.push(
      Object.freeze({
        nightlyPriceClp: raw === "" ? null : parseNightlyRateAmount(raw),
        roomId,
      })
    );
  }
  return Object.freeze(overrides);
}
