import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

export class MercadoPagoWebhookSignatureError extends Error {
  constructor(message: string) {
    super(message);
  }
}

function parseSignatureHeader(header: string) {
  const parts = Object.fromEntries(
    header
      .split(",")
      .map((entry) => entry.split("="))
      .filter((entry): entry is [string, string] => entry.length === 2)
  );
  const timestamp = parts.ts;
  const signature = parts.v1;
  if (!timestamp || !signature) {
    throw new MercadoPagoWebhookSignatureError(
      "x-signature header is missing the timestamp or signature"
    );
  }
  return { timestamp, signature };
}

/**
 * Verifies a Mercado Pago `x-signature` header against the HMAC-SHA256
 * manifest `id:<dataId>;request-id:<requestId>;ts:<ts>;`, per
 * https://www.mercadopago.com/developers/en/docs/checkout-api/additional-content/your-integrations/notifications/webhooks.
 * Either `dataId` or `requestId` may be absent from a given notification —
 * per Mercado Pago's own instructions, an absent value is removed from
 * the manifest entirely rather than included as empty. Throws
 * `MercadoPagoWebhookSignatureError` for a missing/malformed header or a
 * signature mismatch.
 */
export function verifyMercadoPagoWebhookSignature(
  input: Readonly<{
    dataId?: string;
    header: string | null;
    requestId?: string;
    secret: string;
  }>
): void {
  const { dataId, header, requestId, secret } = input;
  if (!header) {
    throw new MercadoPagoWebhookSignatureError("x-signature header is missing");
  }
  const { timestamp, signature } = parseSignatureHeader(header);

  const parts: string[] = [];
  if (dataId) parts.push(`id:${dataId}`);
  if (requestId) parts.push(`request-id:${requestId}`);
  parts.push(`ts:${timestamp}`);
  const manifest = `${parts.join(";")};`;

  const expectedSignature = createHmac("sha256", secret)
    .update(manifest, "utf8")
    .digest("hex");

  const expected = Buffer.from(expectedSignature, "hex");
  const received = Buffer.from(signature, "hex");
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    throw new MercadoPagoWebhookSignatureError("x-signature does not match");
  }
}
