import "server-only";

/**
 * The provider-agnostic port every online-payment provider (Fintoc,
 * Mercado Pago) implements, so the checkout/webhook core
 * (`online-payment-checkout.ts`/`online-payment-webhook.ts`) never
 * references a specific provider's API shape (see
 * `add-mercado-pago-checkout-pro` design.md decision 2).
 */
export type CreateOnlineCheckoutSessionInput = Readonly<{
  amountClp: number;
  cancelUrl: string;
  customerEmail?: string;
  /** The hold's own expiry; a provider that supports it should make the checkout link die at the same instant (design.md decision 6). */
  expiresAt: Date;
  /** The value this call should embed for later webhook correlation (see `OnlineCheckoutSession.externalReference`). */
  externalReference: string;
  successUrl: string;
}>;

export type OnlineCheckoutSession = Readonly<{
  /** The provider's own object id (its checkout session or preference id), for logging only. */
  id: string;
  /**
   * The value that will come back on this provider's webhook/status query
   * for this checkout, used to look up the pending payment
   * (`FintocPaymentRepository.getPaymentByExternalReference`). For a
   * provider whose webhook already carries its own session id directly,
   * this is the same as `id`; for a provider whose webhook only carries an
   * opaque payment id (requiring a follow-up status query that echoes back
   * the caller-supplied `externalReference`), this is that same value.
   */
  externalReference: string;
  redirectUrl: string;
}>;

export type NormalizedPaymentIntentStatus =
  | "created"
  | "in_progress"
  | "succeeded"
  | "failed"
  | "pending"
  | "requires_action"
  | "expired"
  | "rejected"
  | "charged_back";

/**
 * One already signature-verified, already-normalized payment event,
 * regardless of provider. `externalReference` and `paymentIntentId` mirror
 * `OnlineCheckoutSession`'s fields: at least one is always present, but
 * neither is guaranteed alone (an expired checkout with no payment ever
 * attempted has no payment intent either).
 */
export type NormalizedPaymentEvent = Readonly<{
  externalReference?: string;
  id: string;
  occurredAt: Date;
  paymentIntentId?: string;
  paymentIntentStatus?: NormalizedPaymentIntentStatus;
  payload: unknown;
  /** A checkout/session expired before any payment was ever attempted, so there is no payment intent to inspect. */
  sessionExpiredWithoutPayment?: boolean;
  type: string;
}>;

/** Thrown by `parseAndVerifyWebhookEvent` when the request's signature does not check out; the caller must respond with an error status, never process the payload. */
export class InvalidWebhookSignatureError extends Error {
  readonly code = "INVALID_WEBHOOK_SIGNATURE" as const;
}

export type RawWebhookRequest = Readonly<{
  body: string;
  headers: Headers;
  url: string;
}>;

export type OnlinePaymentProvider = Readonly<{
  /** e.g. `"fintoc"` or `"mercado_pago"` — persisted as `payments.provider`. */
  name: string;
  createCheckoutSession: (
    input: CreateOnlineCheckoutSessionInput
  ) => Promise<OnlineCheckoutSession>;
  /**
   * Verifies the request's signature (throwing `InvalidWebhookSignatureError`
   * if it doesn't check out) and normalizes the payload. Returns `null` for
   * a recognized-but-unhandled event shape; the caller should acknowledge
   * that with a 200 rather than retry it forever. May perform an additional
   * provider API call (e.g. Mercado Pago's `GET /v1/payments/{id}`) before
   * returning, since some providers' webhooks carry no payment status.
   */
  parseAndVerifyWebhookEvent: (
    request: RawWebhookRequest
  ) => Promise<NormalizedPaymentEvent | null>;
}>;
