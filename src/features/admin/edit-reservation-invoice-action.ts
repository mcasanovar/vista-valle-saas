"use server";
import { revalidatePath } from "next/cache";

import {
  editReservationInvoice,
  InvalidInvoiceRequestInputError,
  ReservationNotFoundError,
} from "@/features/reservations";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import { createDatabaseBoundary } from "@/infrastructure/database/server";

export type EditReservationInvoiceActionResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      code: "failure" | "validation";
      message: string;
      ok: false;
    }>;

/**
 * Typed core: adds, edits, or removes a reservation's invoice request from
 * already-validated values, resolving production dependencies itself.
 * Available for any reservation regardless of origin or status, mirroring
 * `editAdminReservationGuestContactWithResult`.
 */
export async function editAdminReservationInvoiceWithResult(
  input: Readonly<{
    actorUserId?: string;
    businessActivity?: string;
    email?: string;
    name?: string;
    phone?: string;
    requested: boolean;
    reservationId: string;
    rut?: string;
  }>
): Promise<EditReservationInvoiceActionResult> {
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
      message: "La edición de facturación solo está disponible en producción.",
      ok: false as const,
    });
  }
  const db = createProductionDatabase(boundary);
  const reservationRepository = createDrizzleReservationRepository(db);

  try {
    await editReservationInvoice({ input, reservationRepository });
  } catch (error) {
    if (error instanceof InvalidInvoiceRequestInputError) {
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
      message: "No pudimos actualizar la facturación.",
      ok: false as const,
    });
  }

  return Object.freeze({ ok: true as const });
}

/** Thin `FormData` adapter over `editAdminReservationInvoiceWithResult`. */
export async function editReservationInvoiceAction(
  formData: FormData
): Promise<EditReservationInvoiceActionResult> {
  const user = await requireAdministrator();
  const reservationId = String(formData.get("reservationId") ?? "");

  const result = await editAdminReservationInvoiceWithResult({
    actorUserId: user.user.id,
    businessActivity: String(formData.get("businessActivity") ?? ""),
    email: String(formData.get("email") ?? ""),
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
    requested: formData.get("requested") === "true",
    reservationId,
    rut: String(formData.get("rut") ?? ""),
  });

  if (result.ok) {
    revalidatePath(`/admin/reservas/${reservationId}`);
  }

  return result;
}
