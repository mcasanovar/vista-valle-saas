import { describe, expect, it } from "vitest";

import { createCanonicalMockFintocPaymentRepository } from "@/features/payments/fintoc-payment-repository";
import {
  FintocRefundInputError,
  refundFintocPayment,
} from "@/features/payments/fintoc-refund-service";

/**
 * Under `VISTA_VALLE_CONFIG_CONTEXT=mock` (see .env.test.example),
 * `refundFintocPayment` resolves the same canonical singleton this test
 * seeds directly, so the full service — including its amount/status
 * validation — can be exercised end-to-end without dependency injection.
 */
async function seedApprovedPayment(externalReference: string, amountClp: number) {
  const repository = createCanonicalMockFintocPaymentRepository();
  const pending = await repository.createPendingPayment({
      id: crypto.randomUUID(),
    amountClp,
    externalReference,
    holdId: crypto.randomUUID(),
  });
  const requiresAction = await repository.markRequiresAction(
    pending,
    `pi_${crypto.randomUUID()}`
  );
  const approved = await repository.markApproved(requiresAction, {
    providerPaymentId: requiresAction.providerPaymentId!,
    reservationId: crypto.randomUUID(),
  });
  return approved;
}

describe("refundFintocPayment", () => {
  it("fully refunds an approved payment when no amount is given", async () => {
    const payment = await seedApprovedPayment("cs_full", 200_000);

    const updated = await refundFintocPayment(payment.id);

    expect(updated.status).toBe("refunded");
    expect(updated.refundedAmountClp).toBe(200_000);
  });

  it("partially refunds an approved payment and keeps it approved", async () => {
    const payment = await seedApprovedPayment("cs_partial", 200_000);

    const updated = await refundFintocPayment(payment.id, 50_000);

    expect(updated.status).toBe("approved");
    expect(updated.refundedAmountClp).toBe(50_000);
  });

  it("rejects a refund amount above the remaining balance", async () => {
    const payment = await seedApprovedPayment("cs_over", 100_000);

    await expect(
      refundFintocPayment(payment.id, 150_000)
    ).rejects.toBeInstanceOf(FintocRefundInputError);
  });

  it("rejects refunding a payment that is not approved", async () => {
    const repository = createCanonicalMockFintocPaymentRepository();
    const pending = await repository.createPendingPayment({
      id: crypto.randomUUID(),
      amountClp: 100_000,
      externalReference: "cs_pending",
      holdId: crypto.randomUUID(),
    });

    await expect(
      refundFintocPayment(pending.id)
    ).rejects.toBeInstanceOf(FintocRefundInputError);
  });

  it("rejects an unknown payment id", async () => {
    await expect(
      refundFintocPayment("does-not-exist")
    ).rejects.toBeInstanceOf(FintocRefundInputError);
  });
});
