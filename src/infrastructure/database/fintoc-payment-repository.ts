import "server-only";

import { and, eq } from "drizzle-orm";

import type {
  CreatePendingFintocPaymentInput,
  FintocPaymentRecord,
  FintocPaymentRepository,
} from "@/features/payments";
import { paymentEvents, payments } from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

const paymentColumns = {
  amountClp: payments.amountClp,
  currency: payments.currency,
  externalReference: payments.externalReference,
  holdId: payments.holdId,
  id: payments.id,
  provider: payments.provider,
  providerPaymentId: payments.providerPaymentId,
  refundedAmountClp: payments.refundedAmountClp,
  reservationId: payments.reservationId,
  status: payments.status,
} as const;

function assertNotAlreadyFinal(payment: FintocPaymentRecord) {
  if (payment.status !== "pending" && payment.status !== "requires_action") {
    throw new Error(
      `Fintoc payment ${payment.id} is already in a final state: ${payment.status}`
    );
  }
}

/**
 * Drizzle/PostgreSQL implementation. Every operation here runs against
 * `db` directly rather than a `RoomLockGateway` transaction: none of them
 * change room occupancy by themselves (that only happens when a hold is
 * deleted, which the caller does separately via `HoldRepository.deleteHold`
 * — see `@/features/reservations/confirm-pay-now-reservation.ts`).
 */
export function createDrizzleFintocPaymentRepository(
  db: ProductionDatabase
): FintocPaymentRepository {
  return Object.freeze({
    createPendingPayment: async (
      input: CreatePendingFintocPaymentInput
    ): Promise<FintocPaymentRecord> => {
      const [row] = await db
        .insert(payments)
        .values({
          id: input.id,
          amountClp: input.amountClp,
          externalReference: input.externalReference,
          holdId: input.holdId,
          mode: "pay_now",
          provider: "fintoc",
          status: "pending",
        })
        .returning(paymentColumns);
      if (!row) throw new Error("Failed to insert pending Fintoc payment");
      return Object.freeze(row as FintocPaymentRecord);
    },
    getPaymentByExternalReference: async (externalReference) => {
      const [row] = await db
        .select(paymentColumns)
        .from(payments)
        .where(eq(payments.externalReference, externalReference));
      return row ? Object.freeze(row as FintocPaymentRecord) : null;
    },
    getPaymentByProviderPaymentId: async (providerPaymentId) => {
      const [row] = await db
        .select(paymentColumns)
        .from(payments)
        .where(eq(payments.providerPaymentId, providerPaymentId));
      return row ? Object.freeze(row as FintocPaymentRecord) : null;
    },
    getPaymentByReservationId: async (reservationId) => {
      const [row] = await db
        .select(paymentColumns)
        .from(payments)
        .where(eq(payments.reservationId, reservationId));
      return row ? Object.freeze(row as FintocPaymentRecord) : null;
    },
    getPaymentById: async (id) => {
      const [row] = await db
        .select(paymentColumns)
        .from(payments)
        .where(eq(payments.id, id));
      return row ? Object.freeze(row as FintocPaymentRecord) : null;
    },
    markApproved: async (payment, input) => {
      const [row] = await db
        .update(payments)
        .set({
          providerPaymentId: input.providerPaymentId,
          reservationId: input.reservationId,
          status: "approved",
        })
        .where(eq(payments.id, payment.id))
        .returning(paymentColumns);
      if (!row) throw new Error("Failed to update Fintoc payment");
      return Object.freeze(row as FintocPaymentRecord);
    },
    markRequiresAction: async (payment, providerPaymentId) => {
      assertNotAlreadyFinal(payment);
      const [row] = await db
        .update(payments)
        .set({ providerPaymentId, status: "requires_action" })
        .where(eq(payments.id, payment.id))
        .returning(paymentColumns);
      if (!row) throw new Error("Failed to update Fintoc payment");
      return Object.freeze(row as FintocPaymentRecord);
    },
    markFailed: async (payment, status, providerPaymentId) => {
      assertNotAlreadyFinal(payment);
      const [row] = await db
        .update(payments)
        .set({
          providerPaymentId: providerPaymentId ?? payment.providerPaymentId,
          status,
        })
        .where(eq(payments.id, payment.id))
        .returning(paymentColumns);
      if (!row) throw new Error("Failed to update Fintoc payment");
      return Object.freeze(row as FintocPaymentRecord);
    },
    applyRefund: async (payment, refundAmountClp) => {
      if (payment.status !== "approved") {
        throw new Error(
          `Fintoc payment ${payment.id} is not approved and cannot be refunded`
        );
      }
      if (refundAmountClp <= 0) {
        throw new Error("Refund amount must be positive");
      }
      const refundedAmountClp = payment.refundedAmountClp + refundAmountClp;
      if (refundedAmountClp > payment.amountClp) {
        throw new Error("Refund amount exceeds the payment total");
      }
      const [row] = await db
        .update(payments)
        .set({
          refundedAmountClp,
          status: refundedAmountClp === payment.amountClp ? "refunded" : payment.status,
        })
        .where(eq(payments.id, payment.id))
        .returning(paymentColumns);
      if (!row) throw new Error("Failed to update Fintoc payment");
      return Object.freeze(row as FintocPaymentRecord);
    },
    recordWebhookEvent: async (input) => {
      try {
        await db.insert(paymentEvents).values({
          eventType: input.eventType,
          occurredAt: input.occurredAt,
          paymentId: input.paymentId,
          payload: input.payload,
          provider: "fintoc",
          providerEventId: input.providerEventId,
        });
        return Object.freeze({ alreadyProcessed: false });
      } catch (error) {
        // Unique violation on (provider, provider_event_id): already processed.
        // postgres.js/Drizzle wrap the driver's PostgresError as `.cause` on
        // a generic "Failed query" error, so the code must be read from
        // either the error itself or its cause.
        const code =
          (error as { code?: string } | undefined)?.code ??
          (error as { cause?: { code?: string } } | undefined)?.cause?.code;
        if (code === "23505") {
          return Object.freeze({ alreadyProcessed: true });
        }
        throw error;
      }
    },
    discardWebhookEvent: async (providerEventId) => {
      await db
        .delete(paymentEvents)
        .where(
          and(
            eq(paymentEvents.provider, "fintoc"),
            eq(paymentEvents.providerEventId, providerEventId)
          )
        );
    },
  });
}
