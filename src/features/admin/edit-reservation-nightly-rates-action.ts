"use server";
import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { parseNightlyRateOverrides } from "./nightly-rate-amount";
import {
  editAdminReservationNightlyRatesWithResult,
  type EditReservationNightlyRatesActionResult,
} from "./edit-reservation-nightly-rates-core";

export type {
  EditReservationNightlyRatesActionResult,
  EditReservationNightlyRatesFinancialSummary,
} from "./edit-reservation-nightly-rates-core";

/**
 * Thin `FormData` adapter over `editAdminReservationNightlyRatesWithResult`.
 *
 * Reads exactly the reservation id and the `rate:<roomId>` fields. Any
 * subtotal or total present in the submission is ignored by construction.
 */
export async function editAdminReservationNightlyRatesAction(
  formData: FormData
): Promise<EditReservationNightlyRatesActionResult> {
  const session = await requireAdministrator();
  const id = String(formData.get("id") ?? "");

  const result = await editAdminReservationNightlyRatesWithResult({
    actorUserId: session.user.id,
    overrides: parseNightlyRateOverrides(formData),
    reservationId: id,
  });

  if (result.ok) {
    revalidatePath("/admin/reservas");
    revalidatePath(`/admin/reservas/${id}`);
    revalidatePath("/admin");
  }

  return result;
}
