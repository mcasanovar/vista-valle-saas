"use server";
import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import {
  markPendingPaymentAsPaid,
  PendingPaymentNotFoundError,
} from "@/infrastructure/database/admin-payment-collection";

export type MarkPaymentPaidInput = Readonly<{
  paymentId: string;
  recordedByUserId: string;
}>;

export type MarkPaymentPaidResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      code: "failure" | "not_found" | "validation";
      message: string;
      ok: false;
    }>;

/** Typed core: marks a pending payment as paid from already-validated values. */
export async function markPaymentPaidWithResult(
  input: MarkPaymentPaidInput
): Promise<MarkPaymentPaidResult> {
  if (!input.paymentId) {
    return Object.freeze({
      code: "validation" as const,
      message: "Indica un pago válido.",
      ok: false as const,
    });
  }

  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return Object.freeze({
      code: "failure" as const,
      message: "El cobro de pagos solo está disponible en producción.",
      ok: false as const,
    });
  }
  const db = createProductionDatabase(boundary);

  try {
    await markPendingPaymentAsPaid(db, input.paymentId, input.recordedByUserId);
    return Object.freeze({ ok: true as const });
  } catch (error) {
    if (error instanceof PendingPaymentNotFoundError) {
      return Object.freeze({
        code: "not_found" as const,
        message: "No encontramos un pago pendiente con ese id.",
        ok: false as const,
      });
    }
    return Object.freeze({
      code: "failure" as const,
      message: "No pudimos registrar el pago.",
      ok: false as const,
    });
  }
}

/** Thin `FormData` adapter over `markPaymentPaidWithResult`. */
export async function markPaymentPaidAdminAction(formData: FormData) {
  const session = await requireAdministrator();
  const paymentId = String(formData.get("paymentId") ?? "");
  const reservationId = String(formData.get("reservationId") ?? "");

  const result = await markPaymentPaidWithResult({
    paymentId,
    recordedByUserId: session.user.id,
  });
  if (!result.ok) throw new Error(result.message);

  revalidatePath("/admin/reservas");
  revalidatePath(`/admin/reservas/${reservationId}`);
}
