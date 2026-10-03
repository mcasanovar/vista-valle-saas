import {
  editReservationGuestContact,
  InvalidGuestInputError,
  ReservationNotFoundError,
} from "@/features/reservations";
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
 *
 * Lives outside any `"use server"` module (harden-admin-authentication,
 * task 2.1): only `editReservationGuestContactAction`
 * (`./edit-reservation-guest-contact-action.ts`) may call this after
 * `requireAdministrator()`.
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
