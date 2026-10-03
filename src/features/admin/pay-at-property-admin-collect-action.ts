"use server";
import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { collectPayAtPropertyWithResult } from "./pay-at-property-admin-collect-core";

export type {
  CollectPayAtPropertyInput,
  CollectPayAtPropertyResult,
} from "./pay-at-property-admin-collect-core";

/** Thin `FormData` adapter over `collectPayAtPropertyWithResult`. */
export async function collectPayAtPropertyAdminAction(formData: FormData) {
  const session = await requireAdministrator();
  const reservationId = String(formData.get("reservationId") ?? "");
  const amountClp = Number(formData.get("amountClp"));
  const collectedOn = String(formData.get("collectedOn") ?? "");
  const medium = String(formData.get("medium") ?? "").trim();

  const result = await collectPayAtPropertyWithResult({
    amountClp,
    collectedOn,
    medium,
    recordedByUserId: session.user.id,
    reservationId,
  });
  if (!result.ok) throw new Error(result.message);

  revalidatePath("/admin/reservas");
  revalidatePath(`/admin/reservas/${reservationId}`);
}
