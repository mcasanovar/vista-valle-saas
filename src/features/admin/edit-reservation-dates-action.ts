"use server";

/**
 * Compatibility surface for the dates-only Server Action.
 *
 * The stay edit is a single operation now (dates, rooms and per-room
 * occupancy): `./edit-reservation-stay-action.ts` is the one entry point.
 * This module stays because the AI assistant's operation executor calls
 * `editAdminReservationDatesWithResult` directly, and the dates-only shape
 * is exactly what that path needs - the rooms are simply left untouched.
 *
 * Nothing here re-implements the edit. Do not add logic to this file.
 */
import {
  editAdminReservationStayAction,
  editAdminReservationStayWithResult,
  type EditReservationStayActionResult,
} from "./edit-reservation-stay-action";

/** @deprecated Use `EditReservationStayActionResult`. */
export type EditReservationDatesActionResult = EditReservationStayActionResult;

/**
 * Edits only a reservation's dates, keeping its rooms and occupancy as
 * persisted. Delegates to the stay action's typed core.
 */
export async function editAdminReservationDatesWithResult(
  input: Readonly<{
    actorUserId: string;
    checkIn: string;
    checkOut: string;
    reservationId: string;
  }>
): Promise<EditReservationStayActionResult> {
  if (!input.reservationId || !input.checkIn || !input.checkOut) {
    return Object.freeze({
      code: "validation" as const,
      message: "Completa la reserva y las nuevas fechas.",
      ok: false as const,
    });
  }
  return editAdminReservationStayWithResult(input);
}

/** @deprecated Use `editAdminReservationStayAction`. */
export async function editAdminReservationDatesAction(
  formData: FormData
): Promise<EditReservationStayActionResult> {
  return editAdminReservationStayAction(formData);
}
