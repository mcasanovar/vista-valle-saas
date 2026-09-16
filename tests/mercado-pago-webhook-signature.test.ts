import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  MercadoPagoWebhookSignatureError,
  verifyMercadoPagoWebhookSignature,
} from "@/features/payments/mercado-pago-webhook-signature";

const SECRET = "mp_webhook_test_secret";

function manifest(dataId: string | undefined, requestId: string | undefined, ts: string) {
  const parts: string[] = [];
  if (dataId) parts.push(`id:${dataId}`);
  if (requestId) parts.push(`request-id:${requestId}`);
  parts.push(`ts:${ts}`);
  return `${parts.join(";")};`;
}

function signedHeader(
  dataId: string | undefined,
  requestId: string | undefined,
  ts: string,
  secret = SECRET
) {
  const signature = createHmac("sha256", secret)
    .update(manifest(dataId, requestId, ts), "utf8")
    .digest("hex");
  return `ts=${ts},v1=${signature}`;
}

describe("verifyMercadoPagoWebhookSignature", () => {
  it("accepts a valid signature with both dataId and requestId", () => {
    const ts = "1700000000000";
    const header = signedHeader("123456", "req-1", ts);
    expect(() =>
      verifyMercadoPagoWebhookSignature({
        dataId: "123456",
        header,
        requestId: "req-1",
        secret: SECRET,
      })
    ).not.toThrow();
  });

  it("accepts a valid signature when requestId is absent, per Mercado Pago's manifest rule", () => {
    const ts = "1700000000000";
    const header = signedHeader("123456", undefined, ts);
    expect(() =>
      verifyMercadoPagoWebhookSignature({
        dataId: "123456",
        header,
        secret: SECRET,
      })
    ).not.toThrow();
  });

  it("rejects a missing header", () => {
    expect(() =>
      verifyMercadoPagoWebhookSignature({
        dataId: "123456",
        header: null,
        secret: SECRET,
      })
    ).toThrow(MercadoPagoWebhookSignatureError);
  });

  it("rejects a malformed header", () => {
    expect(() =>
      verifyMercadoPagoWebhookSignature({
        dataId: "123456",
        header: "not-a-valid-header",
        secret: SECRET,
      })
    ).toThrow(MercadoPagoWebhookSignatureError);
  });

  it("rejects a signature computed with the wrong secret", () => {
    const ts = "1700000000000";
    const header = signedHeader("123456", "req-1", ts, "wrong-secret");
    expect(() =>
      verifyMercadoPagoWebhookSignature({
        dataId: "123456",
        header,
        requestId: "req-1",
        secret: SECRET,
      })
    ).toThrow(MercadoPagoWebhookSignatureError);
  });

  it("rejects a signature over a tampered dataId", () => {
    const ts = "1700000000000";
    const header = signedHeader("123456", "req-1", ts);
    expect(() =>
      verifyMercadoPagoWebhookSignature({
        dataId: "999999",
        header,
        requestId: "req-1",
        secret: SECRET,
      })
    ).toThrow(MercadoPagoWebhookSignatureError);
  });
});
