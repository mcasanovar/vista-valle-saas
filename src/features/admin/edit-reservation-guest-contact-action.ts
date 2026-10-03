"use server";
import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/infrastructure/auth/authorization";
import {
  editAdminReservationGuestContactWithResult,
  type EditReservationGuestContactActionResult,
} from "./edit-reservation-guest-contact-core";

export type { EditReservationGuestContactActionResult } from "./edit-reservation-guest-contact-core";

/** Thin `FormData` adapter over `editAdminReservationGuestContactWithResult`. */
export async function editReservationGuestContactAction(
  formData: FormData
): Promise<EditReservationGuestContactActionResult> {
  await requireAdministrator();
  const id = String(formData.get("reservationId") ?? "");
  const firstName = String(formData.get("firstName") ?? "");
  const lastName = String(formData.get("lastName") ?? "");
  const email = String(formData.get("email") ?? "");
  const phone = String(formData.get("phone") ?? "");

  const result = await editAdminReservationGuestContactWithResult({
    email,
    firstName,
    lastName,
    phone,
    reservationId: id,
  });

  if (result.ok) {
    revalidatePath(`/admin/reservas/${id}`);
  }

  return result;
}
