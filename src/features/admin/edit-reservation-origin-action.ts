"use server";
import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/infrastructure/auth/authorization";
import {
  editAdminReservationOriginWithResult,
  type EditReservationOriginActionResult,
} from "./edit-reservation-origin-core";

export type {
  EditReservationOriginActionResult,
  EditReservationOriginFinancialSummary,
} from "./edit-reservation-origin-core";

/**
 * Thin `FormData` adapter over `editAdminReservationOriginWithResult`. Reads
 * exactly the reservation id and the requested origin; any amount present in
 * the submission is ignored by construction.
 */
export async function editAdminReservationOriginAction(
  formData: FormData
): Promise<EditReservationOriginActionResult> {
  const session = await requireAdministrator();
  const id = String(formData.get("id") ?? "");

  const result = await editAdminReservationOriginWithResult({
    actorUserId: session.user.id,
    origin: String(formData.get("origin") ?? ""),
    reservationId: id,
  });

  if (result.ok) {
    revalidatePath("/admin/reservas");
    revalidatePath(`/admin/reservas/${id}`);
    revalidatePath("/admin");
  }

  return result;
}
