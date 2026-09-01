import "server-only";

import { createHmac, timingSafeEqual } from "node:crypto";

/** Fintoc rejects events older than this as a replay-attack precaution (see design.md). */
const DEFAULT_TOLERANCE_SECONDS = 300;

export class FintocWebhookSignatureError extends Error {
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
  const timestamp = parts.t;
  const signature = parts.v1;
  if (!timestamp || !signature) {
    throw new FintocWebhookSignatureError(
      "Fintoc-Signature header is missing the timestamp or signature"
    );
  }
  return { timestamp, signature };
}

/**
 * Verifies a `Fintoc-Signature` header against the raw (unparsed) webhook
 * body, per https://docs.fintoc.com/guides/resources/webhooks-walkthrough/webhooks-validating.
 * Throws `FintocWebhookSignatureError` for any missing header, malformed
 * header, signature mismatch, or event older than `toleranceSeconds`.
 */
export function verifyFintocWebhookSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  options: Readonly<{ toleranceSeconds?: number; now?: () => number }> = {}
): void {
  if (!header) {
    throw new FintocWebhookSignatureError("Fintoc-Signature header is missing");
  }
  const { timestamp, signature } = parseSignatureHeader(header);
  const message = `${timestamp}.${rawBody}`;
  const expectedSignature = createHmac("sha256", secret)
    .update(message, "utf8")
    .digest("hex");

  const expected = Buffer.from(expectedSignature, "hex");
  const received = Buffer.from(signature, "hex");
  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    throw new FintocWebhookSignatureError("Fintoc-Signature does not match");
  }

  const toleranceSeconds = options.toleranceSeconds ?? DEFAULT_TOLERANCE_SECONDS;
  const now = options.now ?? Date.now;
  const eventTimestamp = Number.parseInt(timestamp, 10);
  if (
    !Number.isFinite(eventTimestamp) ||
    Math.abs(now() / 1000 - eventTimestamp) > toleranceSeconds
  ) {
    throw new FintocWebhookSignatureError(
      "Fintoc-Signature timestamp is outside the acceptable tolerance"
    );
  }
}
