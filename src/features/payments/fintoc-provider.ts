import "server-only";

import { getServerEnvironment } from "@/config/server";

import type { FintocClient } from "./fintoc-client";
import { parseFintocWebhookEvent } from "./fintoc-webhook-parser";
import {
  FintocWebhookSignatureError,
  verifyFintocWebhookSignature,
} from "./fintoc-webhook-signature";
import {
  InvalidWebhookSignatureError,
  type OnlinePaymentProvider,
} from "./online-payment-provider";

/**
 * Wraps the existing Fintoc client/signature/parser (unchanged internally
 * — see `add-mercado-pago-checkout-pro` design.md decision 2) into the
 * shared `OnlinePaymentProvider` port, so Fintoc and Mercado Pago can be
 * driven by the same generic checkout/webhook core. `webhookSecret` is
 * only required for `parseAndVerifyWebhookEvent`; a caller that only
 * needs `createCheckoutSession` (e.g. `initiateFintocCheckout`) may omit
 * it.
 */
export function createFintocOnlinePaymentProvider(
  client: FintocClient,
  webhookSecret?: string
): OnlinePaymentProvider {
  return Object.freeze({
    name: "fintoc",
    createCheckoutSession: async (input) => {
      const session = await client.createCheckoutSession({
        amountClp: input.amountClp,
        cancelUrl: input.cancelUrl,
        customerEmail: input.customerEmail,
        externalReference: input.externalReference,
        successUrl: input.successUrl,
      });
      return Object.freeze({
        externalReference: session.id,
        id: session.id,
        redirectUrl: session.redirectUrl,
      });
    },
    parseAndVerifyWebhookEvent: async (request) => {
      if (!webhookSecret) {
        throw new Error(
          "createFintocOnlinePaymentProvider requires webhookSecret to verify webhooks"
        );
      }
      try {
        verifyFintocWebhookSignature(
          request.body,
          request.headers.get("Fintoc-Signature"),
          webhookSecret
        );
      } catch (error) {
        if (error instanceof FintocWebhookSignatureError) {
          throw new InvalidWebhookSignatureError(error.message);
        }
        throw error;
      }
      const rawEvent = JSON.parse(request.body) as unknown;
      const parsed = parseFintocWebhookEvent(rawEvent);
      if (!parsed) return null;
      return Object.freeze({
        externalReference: parsed.checkoutSessionId,
        id: parsed.id,
        occurredAt: parsed.occurredAt,
        paymentIntentId: parsed.paymentIntentId,
        paymentIntentStatus: parsed.paymentIntentStatus,
        payload: parsed.payload,
        sessionExpiredWithoutPayment: parsed.sessionExpiredWithoutPayment,
        type: parsed.type,
      });
    },
  });
}

/** Convenience for production call sites: builds the provider from the real Fintoc client and the configured webhook secret. */
export function getFintocOnlinePaymentProvider(
  client: FintocClient
): OnlinePaymentProvider {
  return createFintocOnlinePaymentProvider(
    client,
    getServerEnvironment().FINTOC_WEBHOOK_SECRET
  );
}
