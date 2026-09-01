"use server";
import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { collectPayAtPropertyPayment } from "@/infrastructure/database/admin-payment-collection";

/**
 * Production counterpart of the mock-only `collectPayAtPropertyAction`
 * (`@/features/payments/actions.ts`), scoped to the admin reservations
 * module. Applies only to `pay_at_property` reservations with a pending
 * payment; a Fintoc-paid reservation has no such payment row, so this
 * action naturally fails for it (see `getPendingPayAtPropertyPayment`).
 */
export async function collectPayAtPropertyAdminAction(formData: FormData) {
  const session = await requireAdministrator();
  const reservationId = String(formData.get("reservationId") ?? "");
  const amountClp = Number(formData.get("amountClp"));
  const collectedOn = String(formData.get("collectedOn") ?? "");
  const medium = String(formData.get("medium") ?? "").trim();

  if (!Number.isSafeInteger(amountClp) || amountClp <= 0) {
    throw new Error("Invalid payment amount");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(collectedOn)) {
    throw new Error("Invalid collection date");
  }
  if (!medium) {
    throw new Error("Invalid collection medium");
  }

  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    throw new Error("Payment collection is only available in production");
  }
  const db = createProductionDatabase(boundary);

  await collectPayAtPropertyPayment(db, reservationId, {
    amountClp,
    collectedOn,
    medium,
    recordedByUserId: session.user.id,
  });

  revalidatePath("/admin/reservas");
  revalidatePath(`/admin/reservas/${reservationId}`);
}
