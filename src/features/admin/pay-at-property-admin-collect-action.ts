"use server";
import { revalidatePath } from "next/cache";

import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import {
  collectPayAtPropertyPayment,
  PendingPayAtPropertyPaymentNotFoundError,
} from "@/infrastructure/database/admin-payment-collection";

export type CollectPayAtPropertyInput = Readonly<{
  amountClp: number;
  collectedOn: string;
  medium: string;
  recordedByUserId: string;
  reservationId: string;
}>;

export type CollectPayAtPropertyResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      code: "failure" | "not_found" | "validation";
      message: string;
      ok: false;
    }>;

/**
 * Typed core: records a `pay_at_property` payment as received from
 * already-validated values. Production counterpart of the mock-only
 * `collectPayAtPropertyAction` (`@/features/payments/actions.ts`), scoped
 * to the admin reservations module. Applies only to `pay_at_property`
 * reservations with a pending payment; a Fintoc-paid reservation has no
 * such payment row, so this naturally reports `not_found` for it (see
 * `getPendingPayAtPropertyPayment`).
 */
export async function collectPayAtPropertyWithResult(
  input: CollectPayAtPropertyInput
): Promise<CollectPayAtPropertyResult> {
  if (!Number.isSafeInteger(input.amountClp) || input.amountClp <= 0) {
    return Object.freeze({
      code: "validation" as const,
      message: "Indica un monto de pago válido.",
      ok: false as const,
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.collectedOn)) {
    return Object.freeze({
      code: "validation" as const,
      message: "Indica una fecha de cobro válida.",
      ok: false as const,
    });
  }
  if (!input.medium.trim()) {
    return Object.freeze({
      code: "validation" as const,
      message: "Indica el medio de cobro.",
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
    await collectPayAtPropertyPayment(db, input.reservationId, {
      amountClp: input.amountClp,
      collectedOn: input.collectedOn,
      medium: input.medium.trim(),
      recordedByUserId: input.recordedByUserId,
    });
    return Object.freeze({ ok: true as const });
  } catch (error) {
    if (error instanceof PendingPayAtPropertyPaymentNotFoundError) {
      return Object.freeze({
        code: "not_found" as const,
        message: "Esta reserva no tiene un pago presencial pendiente.",
        ok: false as const,
      });
    }
    if (error instanceof Error && error.message === "Payment amount must equal the total") {
      return Object.freeze({
        code: "validation" as const,
        message: "El monto debe coincidir con el total de la reserva.",
        ok: false as const,
      });
    }
    return Object.freeze({
      code: "failure" as const,
      message: "No pudimos registrar el cobro.",
      ok: false as const,
    });
  }
}

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
