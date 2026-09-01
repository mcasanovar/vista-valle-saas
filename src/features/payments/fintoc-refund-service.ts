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
  amountClp?: number
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

  try {
    await fintocClient.createRefund({
      paymentIntentId: payment.providerPaymentId,
      ...(refundAmountClp !== payment.amountClp ? { amountClp: refundAmountClp } : {}),
    });
    const updated = await fintocPaymentRepository.applyRefund(
      payment,
      refundAmountClp
    );
    writeStructuredLog("info", "fintoc_refund.applied", {
      paymentId: payment.id,
      refundAmountClp,
      status: updated.status,
    });
    return updated;
  } catch (error) {
    await captureServerException("fintoc_refund.failed", error, {
      paymentId: payment.id,
    });
    throw new FintocRefundUnavailableError(
      "No se pudo procesar el reembolso con Fintoc."
    );
  }
}
