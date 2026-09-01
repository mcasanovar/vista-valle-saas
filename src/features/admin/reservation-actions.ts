"use server";
import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import { createDrizzleRoomLockGateway } from "@/infrastructure/database/room-lock";
import {
  transitionReservationState,
  type ReservationStatus,
} from "@/features/reservations";

const allowedTransitions = ["cancelled", "completed", "no_show"] as const;

/**
 * Cancelling a confirmed reservation is deliberately permissive about
 * dates: the domain layer (`assertConfirmedTransition`) only requires the
 * reservation to still be `confirmed`, regardless of whether its check-in
 * date has already passed (see design.md decision 9). No additional date
 * check is added here.
 */
export async function transitionAdminReservation(formData: FormData) {
  const session = await requireAdministrator();
  const id = String(formData.get("id") ?? "");
  const to = String(
    formData.get("to") ?? ""
  ) as Exclude<ReservationStatus, "confirmed">;
  if (!allowedTransitions.includes(to)) {
    throw new Error("Invalid reservation status");
  }

  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    throw new Error("Reservation operations are only available in production");
  }
  const db = createProductionDatabase(boundary);

  await transitionReservationState({
    actorUserId: session.user.id,
    reservationId: id,
    reservationRepository: createDrizzleReservationRepository(db),
    roomLockGateway: createDrizzleRoomLockGateway(db),
    to,
  });

  revalidatePath("/admin/reservas");
  revalidatePath(`/admin/reservas/${id}`);
}
