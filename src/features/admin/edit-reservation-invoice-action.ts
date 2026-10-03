"use server";
import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/infrastructure/auth/authorization";
import {
  editAdminReservationInvoiceWithResult,
  type EditReservationInvoiceActionResult,
} from "./edit-reservation-invoice-core";

export type { EditReservationInvoiceActionResult } from "./edit-reservation-invoice-core";

/** Thin `FormData` adapter over `editAdminReservationInvoiceWithResult`. */
export async function editReservationInvoiceAction(
  formData: FormData
): Promise<EditReservationInvoiceActionResult> {
  const user = await requireAdministrator();
  const reservationId = String(formData.get("reservationId") ?? "");

  const result = await editAdminReservationInvoiceWithResult({
    actorUserId: user.user.id,
    businessActivity: String(formData.get("businessActivity") ?? ""),
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    requested: formData.get("requested") === "true",
    reservationId,
    rut: String(formData.get("rut") ?? ""),
  });

  if (result.ok) {
    revalidatePath(`/admin/reservas/${reservationId}`);
  }

  return result;
}
