import type { ReservationOrigin } from "./reservation-repository";

/**
 * The origins whose nightly value is set by an agreement outside this
 * system's own rate configuration: what Airbnb or Booking charged, or what
 * the administrator negotiated with the guest over WhatsApp.
 *
 * **Not the same set as `ExternalReservationPlatform`**, which is the pair of
 * platforms this system syncs calendars with (`airbnb`, `booking`, mirroring
 * the `channel` Drizzle enum). The two used to coincide, and this module was
 * named after that coincidence; they no longer do. A reservation being
 * eligible here says nothing about whether a channel connection exists for
 * it.
 *
 * This is the criterion for the **nightly-value override** only. Correcting a
 * reservation's origin is open to all six origins (see `correctableOrigins` in
 * `./edit-reservation-origin.ts`); this list is what decides whether the
 * destination still admits a hand-set value, and therefore whether that value
 * has to be dropped.
 */
export const manualNightlyRateOrigins = [
  "airbnb",
  "booking",
  "whatsapp",
] as const;

export type ManualNightlyRateOrigin = (typeof manualNightlyRateOrigins)[number];

/**
 * Whether an origin admits a hand-set nightly value. The creation path works
 * from a bare origin (no reservation exists yet), so both this and the
 * record-shaped predicate below resolve against the same list.
 */
export function allowsManualNightlyRate(origin: ReservationOrigin): boolean {
  return (manualNightlyRateOrigins as readonly string[]).includes(origin);
}

/**
 * Single point of truth for whether a reservation accepts a hand-set nightly
 * value, kept as an explicit predicate so the UI gate and the server validation
 * share one definition and cannot drift (design.md decision 5). The UI gate is
 * a convenience; the server-side assertion below is the control.
 *
 * Unlike `assertReservationStayEditable`, this one does restrict: only
 * `airbnb`, `booking` and `whatsapp` qualify, because only those reservations
 * have a value the property did not set from its own rates. Status never
 * restricts - `confirmed`, `cancelled`, `completed` and `no_show` are all
 * editable.
 */
export function reservationAllowsManualNightlyRate(
  reservation: Readonly<{ origin: ReservationOrigin }>
): boolean {
  return allowsManualNightlyRate(reservation.origin);
}

/** Thrown when a reservation's origin does not accept a hand-set nightly value. */
export class ManualNightlyRateNotAllowedError extends Error {
  readonly code = "MANUAL_NIGHTLY_RATE_NOT_ALLOWED" as const;
  readonly origin: ReservationOrigin;

  constructor(origin: ReservationOrigin) {
    super(
      `Only ${manualNightlyRateOrigins.join(", ")} reservations accept a hand-set nightly value; this one is ${origin}`
    );
    this.name = "ManualNightlyRateNotAllowedError";
    this.origin = origin;
  }
}

/**
 * Server-side eligibility assertion. Every path that sets a nightly value calls
 * this, so hiding the field in the UI is never what keeps an ineligible
 * reservation safe.
 */
export function assertManualNightlyRateAllowed(
  reservation: Readonly<{ origin: ReservationOrigin }>
): void {
  if (!reservationAllowsManualNightlyRate(reservation)) {
    throw new ManualNightlyRateNotAllowedError(reservation.origin);
  }
}
