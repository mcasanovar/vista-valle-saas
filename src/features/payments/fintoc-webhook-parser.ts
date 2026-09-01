import type { FintocWebhookEvent } from "./fintoc-webhook";

const knownPaymentIntentStatuses = new Set([
  "created",
  "in_progress",
  "succeeded",
  "failed",
  "pending",
  "requires_action",
  "expired",
  "rejected",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function paymentIntentStatus(value: unknown) {
  return typeof value === "string" && knownPaymentIntentStatuses.has(value)
    ? (value as FintocWebhookEvent["paymentIntentStatus"])
    : undefined;
}

/**
 * Normalizes a raw Fintoc webhook body (already signature-verified — see
 * `verifyFintocWebhookSignature`) into `FintocWebhookEvent`. Returns `null`
 * for a malformed or unrecognized-shape payload; the route handler treats
 * that as a no-op 200 (Fintoc should not retry a payload it will never be
 * able to parse).
 *
 * Handles the two shapes Fintoc actually sends (see `FintocWebhookEvent`'s
 * doc comment): `checkout_session.*`, whose `data` is a checkout session
 * with the payment intent nested under `data.payment_resource.payment_intent`,
 * and `payment_intent.*`, whose `data` IS the payment intent object.
 */
export function parseFintocWebhookEvent(raw: unknown): FintocWebhookEvent | null {
  const event = asRecord(raw);
  if (!event) return null;
  const { id, type, data } = event;
  if (typeof id !== "string" || typeof type !== "string") return null;
  const eventData = asRecord(data);
  if (!eventData) return null;
  const occurredAt =
    typeof event.created_at === "string"
      ? new Date(event.created_at)
      : new Date();

  if (type.startsWith("checkout_session.")) {
    const checkoutSessionId =
      typeof eventData.id === "string" ? eventData.id : undefined;
    if (!checkoutSessionId) return null;
    const paymentIntent = asRecord(
      asRecord(eventData.payment_resource)?.payment_intent
    );
    if (!paymentIntent) {
      return Object.freeze({
        checkoutSessionId,
        id,
        occurredAt,
        payload: raw,
        sessionExpiredWithoutPayment: type === "checkout_session.expired",
        type,
      });
    }
    return Object.freeze({
      checkoutSessionId,
      id,
      occurredAt,
      paymentIntentId:
        typeof paymentIntent.id === "string" ? paymentIntent.id : undefined,
      paymentIntentStatus: paymentIntentStatus(paymentIntent.status),
      payload: raw,
      type,
    });
  }

  if (type.startsWith("payment_intent.")) {
    const paymentIntentId =
      typeof eventData.id === "string" ? eventData.id : undefined;
    if (!paymentIntentId) return null;
    return Object.freeze({
      id,
      occurredAt,
      paymentIntentId,
      paymentIntentStatus: paymentIntentStatus(eventData.status),
      payload: raw,
      type,
    });
  }

  return null;
}
