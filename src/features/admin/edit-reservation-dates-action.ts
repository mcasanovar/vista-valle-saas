"use server";

/**
 * Deprecated compatibility `FormData` adapter — see
 * `./edit-reservation-dates-core.ts` for why this module still exists.
 */
import {
  editAdminReservationStayAction,
  type EditReservationStayActionResult,
} from "./edit-reservation-stay-action";

export type { EditReservationDatesActionResult } from "./edit-reservation-dates-core";

/** @deprecated Use `editAdminReservationStayAction`. */
export async function editAdminReservationDatesAction(
  formData: FormData
): Promise<EditReservationStayActionResult> {
  return editAdminReservationStayAction(formData);
}
