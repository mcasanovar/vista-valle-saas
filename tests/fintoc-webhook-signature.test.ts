import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  FintocWebhookSignatureError,
  verifyFintocWebhookSignature,
} from "@/features/payments/fintoc-webhook-signature";

const SECRET = "whsec_test_secret";

function signedHeader(rawBody: string, timestamp: number, secret = SECRET) {
  const signature = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest("hex");
  return `t=${timestamp},v1=${signature}`;
}

describe("verifyFintocWebhookSignature", () => {
  const rawBody = '{"id":"evt_123","type":"payment_intent.succeeded"}';

  it("accepts a valid signature within the tolerance window", () => {
    const now = 1_700_000_000;
    const header = signedHeader(rawBody, now);
    expect(() =>
      verifyFintocWebhookSignature(rawBody, header, SECRET, {
        now: () => now * 1000,
      })
    ).not.toThrow();
  });

  it("rejects a missing header", () => {
    expect(() =>
      verifyFintocWebhookSignature(rawBody, null, SECRET)
    ).toThrow(FintocWebhookSignatureError);
  });

  it("rejects a malformed header", () => {
    expect(() =>
      verifyFintocWebhookSignature(rawBody, "not-a-valid-header", SECRET)
    ).toThrow(FintocWebhookSignatureError);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const now = 1_700_000_000;
    const header = signedHeader(rawBody, now, "wrong-secret");
    expect(() =>
      verifyFintocWebhookSignature(rawBody, header, SECRET, {
        now: () => now * 1000,
      })
    ).toThrow(FintocWebhookSignatureError);
  });

  it("rejects a signature over a tampered body", () => {
    const now = 1_700_000_000;
    const header = signedHeader(rawBody, now);
    expect(() =>
      verifyFintocWebhookSignature(
        '{"id":"evt_123","type":"payment_intent.failed"}',
        header,
        SECRET,
        { now: () => now * 1000 }
      )
    ).toThrow(FintocWebhookSignatureError);
  });

  it("rejects an event older than the tolerance window", () => {
    const now = 1_700_000_000;
    const header = signedHeader(rawBody, now);
    expect(() =>
      verifyFintocWebhookSignature(rawBody, header, SECRET, {
        now: () => (now + 600) * 1000,
      })
    ).toThrow(FintocWebhookSignatureError);
  });
});
