import { describe, expect, it, vi } from "vitest";

import {
  classifyResendHttpFailure,
  createMockResendEmailAdapter,
  createResendEmailAdapter,
  shouldUseRealResendDelivery,
} from "@/features/notifications";

const email = {
  html: "<p>Test</p>",
  idempotencyKey: "email-idempotency-key",
  recipient: "guest@example.test",
  replyTo: "operations@example.test",
  subject: "Test",
} as const;

describe("Resend delivery adapter", () => {
  it("uses real delivery only for production with explicit real mode", () => {
    expect(
      shouldUseRealResendDelivery({
        RESEND_DELIVERY_MODE: "real",
        VISTA_VALLE_CONFIG_CONTEXT: "production",
      })
    ).toBe(true);
    expect(
      shouldUseRealResendDelivery({
        RESEND_DELIVERY_MODE: "mock",
        VISTA_VALLE_CONFIG_CONTEXT: "production",
      })
    ).toBe(false);
    expect(
      shouldUseRealResendDelivery({
        RESEND_DELIVERY_MODE: "real",
        VISTA_VALLE_CONFIG_CONTEXT: "mock",
      })
    ).toBe(false);
  });

  it("keeps mock delivery offline and preserves Reply-To", async () => {
    const send = vi.fn();
    const adapter = createMockResendEmailAdapter(send);

    await adapter.deliver(email);

    expect(send).toHaveBeenCalledWith(email);
    expect(adapter.listDelivered()).toEqual([email]);
  });

  it("classifies 4xx as permanent and 5xx or transport errors as transient", async () => {
    expect(classifyResendHttpFailure(400)).toMatchObject({
      kind: "permanent",
      safeCode: "delivery_permanent",
    });
    expect(classifyResendHttpFailure(500)).toMatchObject({
      kind: "transient",
      safeCode: "delivery_transient",
    });

    const adapter = createResendEmailAdapter({
      send: async () => {
        throw new TypeError("network unavailable");
      },
    });
    await expect(adapter?.deliver(email)).rejects.toMatchObject({
      kind: "transient",
      safeCode: "delivery_transient",
    });
  });
});
