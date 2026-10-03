import "server-only";

import { createDatabaseBoundary } from "@/infrastructure/database/server";
import {
  createProductionDatabase,
} from "@/infrastructure/database/client";
import { createDrizzleFintocPaymentRepository } from "@/infrastructure/database/fintoc-payment-repository";
import {
  captureServerException,
  writeStructuredLog,
} from "@/infrastructure/observability/sentry";

import { getFintocClient } from "./fintoc-client";
import { createCanonicalMockFintocPaymentRepository } from "./fintoc-payment-repository";

export class FintocRefundInputError extends Error {
  readonly code = "INVALID_FINTOC_REFUND_INPUT" as const;
}

/** A deliberately generic error for an unavailable refund attempt, matching `BookingConfirmationUnavailableError`. */
export class FintocRefundUnavailableError extends Error {
  readonly code = "FINTOC_REFUND_UNAVAILABLE" as const;
}

function getDependencies() {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return {
      fintocClient: getFintocClient(),
      fintocPaymentRepository: createCanonicalMockFintocPaymentRepository(),
    };
  }
  const db = createProductionDatabase(boundary);
  return {
    fintocClient: getFintocClient(),
    fintocPaymentRepository: createDrizzleFintocPaymentRepository(db),
  };
}

/**
 * Refunds (fully or partially) an approved Fintoc payment, from the admin
 * panel. Implements the `fintoc-payment-integration` spec's "Reembolso de
 * pagos Fintoc" requirement: only flips the payment to `refunded` once the
 * cumulative refunded amount reaches the full payment total (see
 * `FintocPaymentRepository.applyRefund`).
 */
export async function refundFintocPayment(
  paymentId: string,
  amountClp?: number,
  actorUserId?: string
) {
  const { fintocClient, fintocPaymentRepository } = getDependencies();

  const payment = await fintocPaymentRepository.getPaymentById(paymentId);
  if (!payment) {
    throw new FintocRefundInputError("El pago no existe.");
  }
  if (payment.status !== "approved") {
    throw new FintocRefundInputError(
      "Solo se puede reembolsar un pago aprobado."
    );
  }
  if (!payment.providerPaymentId) {
    throw new FintocRefundInputError(
      "El pago no tiene un identificador de Fintoc asociado."
    );
  }
  const remainingClp = payment.amountClp - payment.refundedAmountClp;
  const refundAmountClp = amountClp ?? remainingClp;
  if (
    !Number.isSafeInteger(refundAmountClp) ||
    refundAmountClp <= 0 ||
    refundAmountClp > remainingClp
  ) {
    throw new FintocRefundInputError("Monto de reembolso inválido.");
  }

  // Idempotent against a resubmission of the same form (harden-admin-
  // authentication, task 8.3): the key is derived purely from
  // `(paymentId, refundAmountClp)`, reusing the webhook event table's
  // existing `(provider, providerEventId)` unique index for the dedup
  // check — a second identical submission reports `alreadyProcessed` and
  // returns the current payment record untouched, without calling Fintoc
  // or crediting the refund a second time.
  const idempotencyKey = `refund:${payment.id}:${refundAmountClp}`;
  const { alreadyProcessed } = await fintocPaymentRepository.recordWebhookEvent({
    eventType: "admin_refund_request",
    occurredAt: new Date(),
    payload: { refundAmountClp },
    paymentId: payment.id,
    providerEventId: idempotencyKey,
  });
  if (alreadyProcessed) {
    writeStructuredLog("info", "fintoc_refund.duplicate_ignored", {
      paymentId: payment.id,
      refundAmountClp,
    });
    return payment;
  }

  try {
    await fintocClient.createRefund({
      paymentIntentId: payment.providerPaymentId,
      ...(refundAmountClp !== payment.amountClp ? { amountClp: refundAmountClp } : {}),
    });
    const updated = await fintocPaymentRepository.applyRefund(
      payment,
      refundAmountClp,
      actorUserId
    );
    writeStructuredLog("info", "fintoc_refund.applied", {
      actorUserId,
      paymentId: payment.id,
      refundAmountClp,
      status: updated.status,
    });
    return updated;
  } catch (error) {
    // The idempotency key was already recorded above; discard it so a
    // transient failure here doesn't permanently block a legitimate retry
    // of this exact (paymentId, refundAmountClp) pair.
    await fintocPaymentRepository.discardWebhookEvent(idempotencyKey);
    await captureServerException("fintoc_refund.failed", error, {
      paymentId: payment.id,
    });
    throw new FintocRefundUnavailableError(
      "No se pudo procesar el reembolso con Fintoc."
    );
  }
}
