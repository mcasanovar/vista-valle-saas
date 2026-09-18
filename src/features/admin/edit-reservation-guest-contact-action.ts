"use server";
import { revalidatePath } from "next/cache";

import {
  editReservationGuestContact,
  InvalidGuestInputError,
  ReservationNotFoundError,
} from "@/features/reservations";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleGuestRepository } from "@/infrastructure/database/guest-repository";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import { createDatabaseBoundary } from "@/infrastructure/database/server";

export type EditReservationGuestContactActionResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      code: "failure" | "validation";
      message: string;
      ok: false;
    }>;

/**
 * Typed core: edits a reservation's guest contact info from
 * already-validated values, resolving production dependencies itself.
 * Available for any reservation regardless of origin or status (proposal
 * "allow-full-reservation-editing-and-ota-sync-toggle"); unlike
 * `editAdminReservationDatesWithResult`, there is no eligibility check to
 * repeat here.
 */
export async function editAdminReservationGuestContactWithResult(
  input: Readonly<{
    email: string;
    firstName: string;
    lastName: string;
    phone: string;
    reservationId: string;
  }>
): Promise<EditReservationGuestContactActionResult> {
  if (!input.reservationId) {
    return Object.freeze({
      code: "validation" as const,
      message: "No encontramos la reserva.",
      ok: false as const,
    });
  }

  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return Object.freeze({
      code: "failure" as const,
      message: "La edición de datos del huésped solo está disponible en producción.",
      ok: false as const,
    });
  }
  const db = createProductionDatabase(boundary);
  const reservationRepository = createDrizzleReservationRepository(db);
  const guestRepository = createDrizzleGuestRepository(db);

  try {
    await editReservationGuestContact({
      guestRepository,
      input,
      reservationRepository,
    });
  } catch (error) {
    if (error instanceof InvalidGuestInputError) {
      return Object.freeze({
        code: "validation" as const,
        message: error.issues.map((issue) => issue.message).join(" "),
        ok: false as const,
      });
    }
    if (error instanceof ReservationNotFoundError) {
      return Object.freeze({
        code: "failure" as const,
        message: "No encontramos la reserva.",
        ok: false as const,
      });
    }
    return Object.freeze({
      code: "failure" as const,
      message: "No pudimos actualizar los datos del huésped.",
      ok: false as const,
    });
  }

  return Object.freeze({ ok: true as const });
}

/** Thin `FormData` adapter over `editAdminReservationGuestContactWithResult`. */
export async function editReservationGuestContactAction(
  formData: FormData
): Promise<EditReservationGuestContactActionResult> {
  await requireAdministrator();
  const id = String(formData.get("reservationId") ?? "");
  const firstName = String(formData.get("firstName") ?? "");
  const lastName = String(formData.get("lastName") ?? "");
  const email = String(formData.get("email") ?? "");
  const phone = String(formData.get("phone") ?? "");

  const result = await editAdminReservationGuestContactWithResult({
    email,
    firstName,
    lastName,
    phone,
    reservationId: id,
  });

  if (result.ok) {
    revalidatePath(`/admin/reservas/${id}`);
  }

  return result;
}
