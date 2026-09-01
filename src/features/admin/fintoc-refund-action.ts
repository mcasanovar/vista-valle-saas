"use server";
import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { refundFintocPayment } from "@/features/payments";

export async function refundFintocPaymentAction(formData: FormData) {
  await requireAdministrator();
  const paymentId = String(formData.get("paymentId") ?? "");
  if (!paymentId) throw new Error("Invalid payment id");
  const rawAmount = formData.get("amountClp");
  const amountClp =
    rawAmount === null || rawAmount === "" ? undefined : Number(rawAmount);

  await refundFintocPayment(paymentId, amountClp);
  revalidatePath("/admin/reservas");
}
