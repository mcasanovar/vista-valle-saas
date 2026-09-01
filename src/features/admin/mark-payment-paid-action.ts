"use server";
import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { markPendingPaymentAsPaid } from "@/infrastructure/database/admin-payment-collection";

export async function markPaymentPaidAdminAction(formData: FormData) {
  const session = await requireAdministrator();
  const paymentId = String(formData.get("paymentId") ?? "");
  const reservationId = String(formData.get("reservationId") ?? "");
  if (!paymentId) throw new Error("Invalid payment id");

  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    throw new Error("Payment collection is only available in production");
  }
  const db = createProductionDatabase(boundary);

  await markPendingPaymentAsPaid(db, paymentId, session.user.id);

  revalidatePath("/admin/reservas");
  revalidatePath(`/admin/reservas/${reservationId}`);
}
