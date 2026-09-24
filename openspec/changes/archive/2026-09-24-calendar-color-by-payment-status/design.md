## Context

`queryAdminCalendar` (`src/infrastructure/database/admin-calendar-source.ts`) builds `AdminCalendarItem[]` from `reservations`/`reservationItems`/`guests`/`rooms` only; it never joins `payments`. `calendarItemStyle` (`src/features/admin/calendar-item-style.ts`) picks the chip color from `item.status` (`confirmed`/`completed`/`cancelled`/`no_show`) via `reservationStatusStyle`. Cancelled reservations are excluded upstream by the query (`ne(reservations.status, "cancelled")`) and stay excluded — out of scope for this change (see proposal.md).

The list view already has a binary payment rollup for a reservation: `AdminReservationPaymentSummary = "paid" | "pending"`, computed in `admin-reservation-source.ts` as "paid if any payment row has `status = 'approved'`, else pending" (rejected/refunded/cancelled/requires_action all collapse into "pending" there). This change reuses that exact rule for the calendar instead of inventing a second one.

## Goals / Non-Goals

**Goals:**
- Every reservation chip/bar in the calendar (classic grid, 7-day timeline, mobile agenda) shows green when paid, yellow when not.
- Reuse the existing paid/not-paid rule (`payments.status = 'approved'` → paid) rather than defining a new payment-status taxonomy for the calendar.

**Non-Goals:**
- No change to which items appear in the calendar (cancelled reservations stay excluded).
- No change to hold/block colors or patterns.
- No new distinction for `no_show` — since reservation color is now 100% payment-driven, `no_show` reservations get whatever color their payment state implies, same as any other reservation. If that turns out to hide operationally-important `no_show` info, that's a separate future change.
- No new icon/text indicator distinguishing paid vs unpaid beyond color. The spec's general "color is never the only signal" principle applies to *type* (reservation vs hold vs block), not to the paid/unpaid sub-state introduced here — this is a deliberate, narrower scope per the proposal.

## Decisions

- **Compute payment status in the calendar query, not client-side.** Add a `payments` join/subquery to `queryAdminCalendar` keyed by `reservations.id`, mirroring the `paymentStatusById` map already built in `admin-reservation-source.ts`. Alternative considered: fetch payments separately per item on the client — rejected, it would mean N extra requests instead of one query.
- **Add `paid: boolean` to `AdminCalendarItem`** (reservation items only; `undefined`/absent for hold and block items, same convention already used for `status`/`origin`/`guestName`/`reason`).
- **`calendarItemStyle` branches on `item.paid` for `kind === "reservation"`**, instead of looking up `reservationStatusStyle[item.status]`. The `reservationStatusStyle` map and its `cancelled`/`completed`/`no_show` entries become dead code and are removed (cancelled reservations never reach this function; completed/no_show now render by `paid`).
- **New CSS tokens** `--admin-reservation-paid` / `--admin-reservation-paid-background` and `--admin-reservation-unpaid` / `--admin-reservation-unpaid-background` in `app/globals.css`, next to the existing `--admin-reservation-*` block. The current green (`--admin-reservation-confirmed: #2f8f5b`) is reused as-is for "paid" (it's already the color on screen today for the common case: confirmed + paid). A **new** yellow is introduced for "unpaid" rather than reusing `--admin-reservation-pending` (`#b5702a`, visually amber/brown) — the user asked specifically for yellow (`amarillo`), and reusing the old "no_show" token would carry the wrong connotation now that it means "unpaid", not "guest didn't show up".
- **`CalendarLegend`** (`calendar-view.tsx`) updates its two reservation entries from "Reserva confirmada" / "No se presentó" to "Pagada" / "No pagada", pointing at the new tokens. Hold/block entries are untouched.

## Risks / Trade-offs

- [Losing a color-coded signal for `no_show`] → Accepted per explicit user scope decision; `no_show` is still visible in the item's detail panel (status field), just not color-coded in the grid anymore.
- [A reservation with a `rejected`/`requires_action` payment looks identical to one with no payment at all — both "unpaid"/yellow] → Matches the existing list-view rule exactly, so it's a consistent (if coarse) signal across the admin; the detail panel remains the place to see the specific payment status.

## Migration Plan

- Additive query change + a pure function/CSS rename; no data migration. Ship as one PR: query, style function, tokens, legend, then visually verify a month with both paid and unpaid confirmed reservations.
- Rollback: revert the PR: `calendarItemStyle` and the query change are self-contained.
