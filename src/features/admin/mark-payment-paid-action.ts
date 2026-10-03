"use server";
import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { markPaymentPaidWithResult } from "./mark-payment-paid-core";

export type { MarkPaymentPaidInput, MarkPaymentPaidResult } from "./mark-payment-paid-core";

/** Thin `FormData` adapter over `markPaymentPaidWithResult`. */
export async function markPaymentPaidAdminAction(formData: FormData) {
  const session = await requireAdministrator();
  const paymentId = String(formData.get("paymentId") ?? "");
  const reservationId = String(formData.get("reservationId") ?? "");

  const result = await markPaymentPaidWithResult({
    paymentId,
    recordedByUserId: session.user.id,
  });
  if (!result.ok) throw new Error(result.message);

  revalidatePath("/admin/reservas");
  revalidatePath(`/admin/reservas/${reservationId}`);
}
