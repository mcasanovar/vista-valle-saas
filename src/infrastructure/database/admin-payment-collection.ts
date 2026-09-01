import "server-only";

import { and, eq } from "drizzle-orm";

import { auditEvents, payments } from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

export class PendingPayAtPropertyPaymentNotFoundError extends Error {
  readonly code = "PENDING_PAY_AT_PROPERTY_PAYMENT_NOT_FOUND" as const;
}

/**
 * Locates the pending `pay_at_property` payment for a reservation — never a
 * `fintoc` (or other online-payment provider) payment, so this action
 * structurally cannot apply to a reservation paid online (see
 * `reservation-administration` spec, "Registro de pago presencial").
 */
export async function getPendingPayAtPropertyPayment(
  db: ProductionDatabase,
  reservationId: string
) {
  const [row] = await db
    .select()
    .from(payments)
    .where(
      and(
        eq(payments.reservationId, reservationId),
        eq(payments.provider, "pay_at_property"),
        eq(payments.status, "pending")
      )
    );
  return row ?? null;
}

export type CollectPayAtPropertyPaymentInput = Readonly<{
  amountClp: number;
  collectedOn: string;
  medium: string;
  recordedByUserId: string;
}>;

/**
 * Marks a `pay_at_property` payment as received. No date restriction: a
 * payment may be recorded any time after the reservation was created,
 * including days after the stay ended (see design.md decision 6).
 */
export async function collectPayAtPropertyPayment(
  db: ProductionDatabase,
  reservationId: string,
  input: CollectPayAtPropertyPaymentInput
) {
  const pending = await getPendingPayAtPropertyPayment(db, reservationId);
  if (!pending) {
    throw new PendingPayAtPropertyPaymentNotFoundError(
      `No pending pay-at-property payment for reservation ${reservationId}`
    );
  }
  if (input.amountClp !== pending.amountClp) {
    throw new Error("Payment amount must equal the total");
  }

  const [updated] = await db
    .update(payments)
    .set({
      paymentMethod: input.medium,
      receivedAt: new Date(`${input.collectedOn}T00:00:00.000Z`),
      recordedByUserId: input.recordedByUserId,
      status: "approved",
    })
    .where(eq(payments.id, pending.id))
    .returning();
  if (!updated) throw new Error("Failed to update pay-at-property payment");

  await db.insert(auditEvents).values({
    action: "payment.collected",
    actorUserId: input.recordedByUserId,
    after: { status: "approved" },
    before: { status: "pending" },
    entityId: updated.id,
    entityType: "payment",
  });

  return updated;
}

export class PendingPaymentNotFoundError extends Error {
  readonly code = "PENDING_PAYMENT_NOT_FOUND" as const;
}

/**
 * Manual override for any pending payment (e.g. Fintoc pending because a
 * webhook never arrived) — marks it approved without requiring amount/date/
 * medium details, unlike `collectPayAtPropertyPayment`.
 */
export async function markPendingPaymentAsPaid(
  db: ProductionDatabase,
  paymentId: string,
  recordedByUserId: string
) {
  const [pending] = await db
    .select()
    .from(payments)
    .where(and(eq(payments.id, paymentId), eq(payments.status, "pending")));
  if (!pending) {
    throw new PendingPaymentNotFoundError(
      `No pending payment with id ${paymentId}`
    );
  }

  const [updated] = await db
    .update(payments)
    .set({
      paymentMethod: pending.paymentMethod ?? "manual_admin_override",
      receivedAt: new Date(),
      recordedByUserId,
      status: "approved",
    })
    .where(eq(payments.id, pending.id))
    .returning();
  if (!updated) throw new Error("Failed to update payment");

  await db.insert(auditEvents).values({
    action: "payment.collected",
    actorUserId: recordedByUserId,
    after: { status: "approved" },
    before: { status: "pending" },
    entityId: updated.id,
    entityType: "payment",
  });

  return updated;
}
