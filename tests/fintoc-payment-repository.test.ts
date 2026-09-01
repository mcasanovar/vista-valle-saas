import { describe, expect, it } from "vitest";

import { createMockFintocPaymentRepository } from "@/features/payments/fintoc-payment-repository";

function setUp() {
  return createMockFintocPaymentRepository();
}

describe("createMockFintocPaymentRepository", () => {
  it("creates a pending payment against a hold and finds it by external reference", async () => {
    const repository = setUp();
    const payment = await repository.createPendingPayment({
      id: crypto.randomUUID(),
      amountClp: 180_000,
      externalReference: "cs_123",
      holdId: "hold-1",
    });

    expect(payment.status).toBe("pending");
    expect(payment.holdId).toBe("hold-1");
    expect(payment.reservationId).toBeNull();
    expect(payment.refundedAmountClp).toBe(0);

    await expect(
      repository.getPaymentByExternalReference("cs_123")
    ).resolves.toEqual(payment);
    await expect(repository.getPaymentById(payment.id)).resolves.toEqual(
      payment
    );
    await expect(
      repository.getPaymentByExternalReference("unknown")
    ).resolves.toBeNull();
  });

  it("marks a payment as requiring further action without touching amounts", async () => {
    const repository = setUp();
    const payment = await repository.createPendingPayment({
      id: crypto.randomUUID(),
      amountClp: 100_000,
      externalReference: "cs_1",
      holdId: "hold-1",
    });

    const updated = await repository.markRequiresAction(payment, "pi_1");
    expect(updated.status).toBe("requires_action");
    expect(updated.providerPaymentId).toBe("pi_1");
  });

  it("marks a payment as rejected or cancelled", async () => {
    const repository = setUp();
    const payment = await repository.createPendingPayment({
      id: crypto.randomUUID(),
      amountClp: 100_000,
      externalReference: "cs_2",
      holdId: "hold-2",
    });

    const rejected = await repository.markFailed(payment, "rejected", "pi_2");
    expect(rejected.status).toBe("rejected");
    expect(rejected.providerPaymentId).toBe("pi_2");
  });

  it("rejects updating a payment that is already in a final state", async () => {
    const repository = setUp();
    const payment = await repository.createPendingPayment({
      id: crypto.randomUUID(),
      amountClp: 100_000,
      externalReference: "cs_3",
      holdId: "hold-3",
    });
    const rejected = await repository.markFailed(payment, "rejected");

    await expect(
      repository.markFailed(rejected, "rejected")
    ).rejects.toThrow(/already in a final state/);
    await expect(
      repository.markRequiresAction(rejected, "pi_x")
    ).rejects.toThrow(/already in a final state/);
  });

  it("applies a partial refund without flipping status to refunded", async () => {
    const repository = setUp();
    const payment = await repository.createPendingPayment({
      id: crypto.randomUUID(),
      amountClp: 100_000,
      externalReference: "cs_4",
      holdId: "hold-4",
    });
    // A refund only ever applies to an approved payment - simulate approval
    // the way `createConfirmedPayNowReservation` would (status update only,
    // since the full reservation-creation path is covered elsewhere).
    const approved = await repository.markRequiresAction(payment, "pi_4");
    const forcedApproved = { ...approved, status: "approved" as const };

    const partiallyRefunded = await repository.applyRefund(
      forcedApproved,
      40_000
    );
    expect(partiallyRefunded.status).toBe("approved");
    expect(partiallyRefunded.refundedAmountClp).toBe(40_000);

    const fullyRefunded = await repository.applyRefund(
      partiallyRefunded,
      60_000
    );
    expect(fullyRefunded.status).toBe("refunded");
    expect(fullyRefunded.refundedAmountClp).toBe(100_000);
  });

  it("rejects a refund larger than the remaining payment total", async () => {
    const repository = setUp();
    const payment = await repository.createPendingPayment({
      id: crypto.randomUUID(),
      amountClp: 100_000,
      externalReference: "cs_5",
      holdId: "hold-5",
    });
    const approved = { ...payment, status: "approved" as const };

    await expect(repository.applyRefund(approved, 150_000)).rejects.toThrow(
      /exceeds the payment total/
    );
  });

  it("records a webhook event once and reports duplicates on retry", async () => {
    const repository = setUp();
    const first = await repository.recordWebhookEvent({
      eventType: "payment_intent.succeeded",
      occurredAt: new Date(),
      payload: {},
      paymentId: "payment-1",
      providerEventId: "evt_1",
    });
    const duplicate = await repository.recordWebhookEvent({
      eventType: "payment_intent.succeeded",
      occurredAt: new Date(),
      payload: {},
      paymentId: "payment-1",
      providerEventId: "evt_1",
    });

    expect(first.alreadyProcessed).toBe(false);
    expect(duplicate.alreadyProcessed).toBe(true);
  });
});
