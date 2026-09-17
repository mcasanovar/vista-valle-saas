"use server";
import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import { createDrizzleRoomLockGateway } from "@/infrastructure/database/room-lock";
import {
  ReservationNotFoundError,
  ReservationStateTransitionError,
  transitionReservationState,
  type ReservationRecord,
  type ReservationStatus,
} from "@/features/reservations";

const allowedTransitions = ["cancelled", "completed", "no_show"] as const;

export type AdminReservationTransition = Exclude<
  ReservationStatus,
  "confirmed"
>;

export type TransitionAdminReservationInput = Readonly<{
  actorUserId: string;
  reservationId: string;
  to: AdminReservationTransition;
}>;

export type TransitionAdminReservationResult =
  | Readonly<{ ok: true; reservation: ReservationRecord }>
  | Readonly<{
      code: "failure" | "invalid_transition" | "not_found" | "validation";
      message: string;
      ok: false;
    }>;

/**
 * Typed core: transitions a reservation's status from already-validated
 * values, returning a typed result instead of throwing. Cancelling a
 * confirmed reservation is deliberately permissive about dates: the domain
 * layer (`assertConfirmedTransition`) only requires the reservation to
 * still be `confirmed`, regardless of whether its check-in date has already
 * passed (see design.md decision 9). No additional date check is added
 * here. Never touches payment state — cancellations do not trigger refunds
 * (proposal.md "Cancelaciones sin reembolso").
 */
export async function transitionAdminReservationWithResult(
  input: TransitionAdminReservationInput
): Promise<TransitionAdminReservationResult> {
  if (!allowedTransitions.includes(input.to)) {
    return Object.freeze({
      code: "validation" as const,
      message: "Estado de reserva inválido.",
      ok: false as const,
    });
  }

  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return Object.freeze({
      code: "failure" as const,
      message: "Las reservas solo se pueden operar en producción.",
      ok: false as const,
    });
  }
  const db = createProductionDatabase(boundary);

  try {
    const reservation = await transitionReservationState({
      actorUserId: input.actorUserId,
      reservationId: input.reservationId,
      reservationRepository: createDrizzleReservationRepository(db),
      roomLockGateway: createDrizzleRoomLockGateway(db),
      to: input.to,
    });
    return Object.freeze({ ok: true as const, reservation });
  } catch (error) {
    if (error instanceof ReservationNotFoundError) {
      return Object.freeze({
        code: "not_found" as const,
        message: "No encontramos la reserva.",
        ok: false as const,
      });
    }
    if (error instanceof ReservationStateTransitionError) {
      return Object.freeze({
        code: "invalid_transition" as const,
        message: error.message,
        ok: false as const,
      });
    }
    return Object.freeze({
      code: "failure" as const,
      message: "No pudimos actualizar el estado.",
      ok: false as const,
    });
  }
}

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
