import { describe, expect, it } from "vitest";

import { parseFintocWebhookEvent } from "@/features/payments/fintoc-webhook-parser";

describe("parseFintocWebhookEvent", () => {
  it("parses checkout_session.finished with a nested succeeded payment_intent", () => {
    const raw = {
      id: "evt_1",
      type: "checkout_session.finished",
      created_at: "2026-01-13T18:48:25.000Z",
      data: {
        id: "cs_123",
        object: "checkout_session",
        payment_resource: {
          payment_intent: { id: "pi_123", status: "succeeded" },
        },
      },
    };

    const parsed = parseFintocWebhookEvent(raw);
    expect(parsed).toMatchObject({
      checkoutSessionId: "cs_123",
      id: "evt_1",
      paymentIntentId: "pi_123",
      paymentIntentStatus: "succeeded",
      type: "checkout_session.finished",
    });
    expect(parsed?.occurredAt).toEqual(new Date("2026-01-13T18:48:25.000Z"));
  });

  it("parses checkout_session.expired with no payment ever attempted", () => {
    const raw = {
      id: "evt_2",
      type: "checkout_session.expired",
      data: { id: "cs_456", object: "checkout_session" },
    };

    const parsed = parseFintocWebhookEvent(raw);
    expect(parsed).toMatchObject({
      checkoutSessionId: "cs_456",
      sessionExpiredWithoutPayment: true,
    });
    expect(parsed?.paymentIntentId).toBeUndefined();
  });

  it("parses a standalone payment_intent.succeeded event with no checkout session reference", () => {
    const raw = {
      id: "evt_3",
      type: "payment_intent.succeeded",
      data: { id: "pi_789", object: "payment_intent", status: "succeeded" },
    };

    const parsed = parseFintocWebhookEvent(raw);
    expect(parsed).toMatchObject({
      id: "evt_3",
      paymentIntentId: "pi_789",
      paymentIntentStatus: "succeeded",
      type: "payment_intent.succeeded",
    });
    expect(parsed?.checkoutSessionId).toBeUndefined();
  });

  it("parses a payment_intent.pending event carrying a requires_action status", () => {
    const raw = {
      id: "evt_4",
      type: "payment_intent.pending",
      data: { id: "pi_999", object: "payment_intent", status: "requires_action" },
    };

    const parsed = parseFintocWebhookEvent(raw);
    expect(parsed?.paymentIntentStatus).toBe("requires_action");
  });

  it("returns null for an unrecognized event type", () => {
    const raw = {
      id: "evt_5",
      type: "refund.succeeded",
      data: { id: "re_1", object: "refund" },
    };

    expect(parseFintocWebhookEvent(raw)).toBeNull();
  });

  it("returns null for a malformed payload", () => {
    expect(parseFintocWebhookEvent(null)).toBeNull();
    expect(parseFintocWebhookEvent({})).toBeNull();
    expect(
      parseFintocWebhookEvent({ id: "evt_6", type: "checkout_session.finished" })
    ).toBeNull();
  });
});
