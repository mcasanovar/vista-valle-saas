import "server-only";

import { getServerEnvironment } from "@/config/server";

import type {
  MercadoPagoClient,
  MercadoPagoPaymentStatus,
} from "./mercado-pago-client";
import {
  MercadoPagoWebhookSignatureError,
  verifyMercadoPagoWebhookSignature,
} from "./mercado-pago-webhook-signature";
import {
  InvalidWebhookSignatureError,
  type NormalizedPaymentIntentStatus,
  type OnlinePaymentProvider,
} from "./online-payment-provider";

/**
 * Maps Mercado Pago's payment status to the shared normalized status (see
 * `add-mercado-pago-checkout-pro` design.md decision 4). `in_mediation`
 * (a dispute opened before a formal contracargo) and `refunded` (no
 * Mercado-Pago-initiated refund flow is implemented) intentionally map to
 * `undefined` — no action is taken on either until a final `charged_back`
 * arrives.
 */
function toNormalizedStatus(
  status: MercadoPagoPaymentStatus
): NormalizedPaymentIntentStatus | undefined {
  switch (status) {
    case "approved":
      return "succeeded";
    case "authorized":
    case "in_process":
      return "requires_action";
    case "pending":
      return "pending";
    case "rejected":
      return "rejected";
    case "cancelled":
      return "expired";
    case "charged_back":
      return "charged_back";
    default:
      return undefined;
  }
}

/**
 * Wraps the Mercado Pago client/webhook-signature verification into the
 * shared `OnlinePaymentProvider` port (see design.md decision 2).
 * `parseAndVerifyWebhookEvent` performs the follow-up
 * `GET /v1/payments/{id}` call the design requires (decision 4): Mercado
 * Pago's own notification carries no payment status, only an id.
 */
export function createMercadoPagoOnlinePaymentProvider(
  client: MercadoPagoClient,
  webhookSecret?: string
): OnlinePaymentProvider {
  return Object.freeze({
    name: "mercado_pago",
    createCheckoutSession: async (input) => {
      const preference = await client.createPreference({
        amountClp: input.amountClp,
        cancelUrl: input.cancelUrl,
        customerEmail: input.customerEmail,
        expiresAt: input.expiresAt,
        externalReference: input.externalReference,
        successUrl: input.successUrl,
      });
      return Object.freeze({
        // Mercado Pago echoes the preference's `external_reference` back
        // onto the resulting payment (see `getPayment`), so that — not
        // the preference's own id — is what the webhook correlates by.
        externalReference: input.externalReference,
        id: preference.id,
        redirectUrl: preference.initPoint,
      });
    },
    parseAndVerifyWebhookEvent: async (request) => {
      if (!webhookSecret) {
        throw new Error(
          "createMercadoPagoOnlinePaymentProvider requires webhookSecret to verify webhooks"
        );
      }
      const url = new URL(request.url);
      const body = request.body
        ? (JSON.parse(request.body) as {
            type?: string;
            action?: string;
            data?: { id?: string | number };
          })
        : {};
      const dataId =
        (body.data?.id !== undefined ? String(body.data.id) : undefined) ??
        url.searchParams.get("data.id") ??
        url.searchParams.get("id") ??
        undefined;
      const requestId = request.headers.get("x-request-id") ?? undefined;

      try {
        verifyMercadoPagoWebhookSignature({
          dataId,
          header: request.headers.get("x-signature"),
          requestId,
          secret: webhookSecret,
        });
      } catch (error) {
        if (error instanceof MercadoPagoWebhookSignatureError) {
          throw new InvalidWebhookSignatureError(error.message);
        }
        throw error;
      }

      const type = body.type ?? url.searchParams.get("type");
      if (type !== "payment" || !dataId) {
        // A topic this handler does not act on (e.g. `merchant_order`),
        // or a payload with no payment id to look up.
        return null;
      }

      const payment = await client.getPayment(dataId);
      const paymentIntentStatus = toNormalizedStatus(payment.status);

      return Object.freeze({
        externalReference: payment.externalReference,
        // Synthetic, provider-owned idempotency key (design.md decision
        // 5): Mercado Pago does not guarantee a stable notification id
        // across retries, but `(paymentId, status)` is stable and
        // sufficient — a redelivery of the same status is a no-op, and a
        // genuine status change is a new key by construction.
        id: `${payment.id}:${payment.status}`,
        occurredAt: new Date(),
        paymentIntentId: payment.id,
        paymentIntentStatus,
        payload: body,
        type: "payment",
      });
    },
  });
}

/** Convenience for production call sites: builds the provider from the real Mercado Pago client and the configured webhook secret. */
export function getMercadoPagoOnlinePaymentProvider(
  client: MercadoPagoClient
): OnlinePaymentProvider {
  return createMercadoPagoOnlinePaymentProvider(
    client,
    getServerEnvironment().MERCADO_PAGO_WEBHOOK_SECRET
  );
}
