"use server";
import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/infrastructure/auth/authorization";
import {
  transitionAdminReservationWithResult,
  type AdminReservationTransition,
} from "./reservation-actions-core";

export type {
  AdminReservationTransition,
  TransitionAdminReservationInput,
  TransitionAdminReservationResult,
} from "./reservation-actions-core";

/** Thin `FormData` adapter over `transitionAdminReservationWithResult`. */
export async function transitionAdminReservation(formData: FormData) {
  const session = await requireAdministrator();
  const id = String(formData.get("id") ?? "");
  const to = String(formData.get("to") ?? "") as AdminReservationTransition;

  const result = await transitionAdminReservationWithResult({
    actorUserId: session.user.id,
    reservationId: id,
    to,
  });
  if (!result.ok) throw new Error(result.message);

  revalidatePath("/admin/reservas");
  revalidatePath(`/admin/reservas/${id}`);
}
