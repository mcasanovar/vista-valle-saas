import type { ReservationOrigin } from "./reservation-repository";

/**
 * The origins whose nightly value is set by an external channel rather than
 * by this system's own rate configuration. Mirrors the `channel` Drizzle enum.
 *
 * This is the criterion for the **nightly-value override** only. Correcting a
 * reservation's origin is open to all six origins (see `correctableOrigins` in
 * `./edit-reservation-origin.ts`); this list is what decides whether the
 * destination still admits a hand-set value, and therefore whether that value
 * has to be dropped.
 */
export const externalChannelOrigins = ["airbnb", "booking"] as const;

export type ExternalChannelOrigin = (typeof externalChannelOrigins)[number];

/**
 * Whether an origin is one of the two external channels. The creation path
 * works from a bare origin (no reservation exists yet), so both this and the
 * record-shaped predicate below resolve against the same list.
 */
export function isExternalChannelOrigin(origin: ReservationOrigin): boolean {
  return (externalChannelOrigins as readonly string[]).includes(origin);
}

/**
 * Single point of truth for whether a reservation accepts a hand-set nightly
 * value, kept as an explicit predicate so the UI gate and the server validation
 * share one definition and cannot drift (design.md decision 5). The UI gate is
 * a convenience; the server-side assertion below is the control.
 *
 * Unlike `assertReservationStayEditable`, this one does restrict: only `airbnb`
 * and `booking` qualify, because only those reservations have a value the
 * property did not set. Status never restricts - `confirmed`, `cancelled`,
 * `completed` and `no_show` are all editable.
 */
export function isExternalChannelReservation(
  reservation: Readonly<{ origin: ReservationOrigin }>
): boolean {
  return isExternalChannelOrigin(reservation.origin);
}

/** Thrown when a reservation's origin does not accept a hand-set nightly value. */
export class ReservationNotExternalChannelError extends Error {
  readonly code = "RESERVATION_NOT_EXTERNAL_CHANNEL" as const;
  readonly origin: ReservationOrigin;

  constructor(origin: ReservationOrigin) {
    super(
      `Only airbnb and booking reservations accept a hand-set nightly value; this one is ${origin}`
    );
    this.name = "ReservationNotExternalChannelError";
    this.origin = origin;
  }
}

/**
 * Server-side eligibility assertion. Every path that sets a nightly value calls
 * this, so hiding the field in the UI is never what keeps an ineligible
 * reservation safe.
 */
export function assertExternalChannelReservation(
  reservation: Readonly<{ origin: ReservationOrigin }>
): void {
  if (!isExternalChannelReservation(reservation)) {
    throw new ReservationNotExternalChannelError(reservation.origin);
  }
}
