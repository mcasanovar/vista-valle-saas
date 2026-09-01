import "server-only";

import { getServerEnvironment } from "@/config/server";

const FINTOC_API_BASE_URL = "https://api.fintoc.com/v1";

export type CreateFintocCheckoutSessionInput = Readonly<{
  amountClp: number;
  externalReference: string;
  customerEmail?: string;
  successUrl: string;
  cancelUrl: string;
}>;

export type FintocCheckoutSession = Readonly<{
  id: string;
  redirectUrl: string;
}>;

export type CreateFintocRefundInput = Readonly<{
  paymentIntentId: string;
  /** Omit for a full refund; provide the minor-unit amount for a partial refund. */
  amountClp?: number;
}>;

export type FintocRefund = Readonly<{
  id: string;
  status: string;
}>;

/**
 * `kind: "permanent"` (a 4xx from Fintoc, e.g. invalid amount) means retrying
 * the same request will not help; `"transient"` (network failure or 5xx)
 * means it might.
 */
export class FintocApiError extends Error {
  constructor(
    readonly kind: "permanent" | "transient",
    message = "Fintoc API request failed"
  ) {
    super(message);
  }
}

export type FintocTransport = Readonly<{
  createCheckoutSession: (
    input: CreateFintocCheckoutSessionInput
  ) => Promise<FintocCheckoutSession>;
  createRefund: (input: CreateFintocRefundInput) => Promise<FintocRefund>;
}>;

export type FintocClient = Readonly<{
  createCheckoutSession: (
    input: CreateFintocCheckoutSessionInput
  ) => Promise<FintocCheckoutSession>;
  createRefund: (input: CreateFintocRefundInput) => Promise<FintocRefund>;
}>;

/** Typed server-only boundary for Fintoc; production wiring requires an injected transport (see `resend-adapter.ts` for the same pattern). */
export function createFintocClient(
  transport: FintocTransport | null
): FintocClient | null {
  if (!transport) return null;
  return Object.freeze({
    createCheckoutSession: async (input) => {
      try {
        return await transport.createCheckoutSession(input);
      } catch (error) {
        if (error instanceof FintocApiError) throw error;
        throw new FintocApiError("transient");
      }
    },
    createRefund: async (input) => {
      try {
        return await transport.createRefund(input);
      } catch (error) {
        if (error instanceof FintocApiError) throw error;
        throw new FintocApiError("transient");
      }
    },
  });
}

function fintocErrorKind(status: number): "permanent" | "transient" {
  return status >= 500 ? "transient" : "permanent";
}

/** Always returns a usable client: the mock branch never returns null, and the production branch always supplies a transport (see `createFintocClient`). */
export function getFintocClient(): FintocClient {
  const environment = getServerEnvironment();
  if (environment.VISTA_VALLE_CONFIG_CONTEXT === "mock") {
    return createMockFintocClient();
  }
  return createFintocClient({
    createCheckoutSession: async (input) => {
      const response = await fetch(`${FINTOC_API_BASE_URL}/checkout_sessions`, {
        method: "POST",
        headers: {
          Authorization: environment.FINTOC_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          amount: input.amountClp,
          currency: "CLP",
          flow: "payment",
          success_url: input.successUrl,
          cancel_url: input.cancelUrl,
          ...(input.customerEmail
            ? { customer_email: input.customerEmail }
            : {}),
          metadata: { external_reference: input.externalReference },
        }),
      });
      if (!response.ok) {
        throw new FintocApiError(fintocErrorKind(response.status));
      }
      const data = (await response.json()) as {
        id: string;
        redirect_url: string;
      };
      return Object.freeze({ id: data.id, redirectUrl: data.redirect_url });
    },
    createRefund: async (input) => {
      const response = await fetch(`${FINTOC_API_BASE_URL}/refunds`, {
        method: "POST",
        headers: {
          Authorization: environment.FINTOC_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          resource_id: input.paymentIntentId,
          resource_type: "payment_intent",
          ...(input.amountClp !== undefined ? { amount: input.amountClp } : {}),
        }),
      });
      if (!response.ok) {
        throw new FintocApiError(fintocErrorKind(response.status));
      }
      const data = (await response.json()) as { id: string; status: string };
      return Object.freeze({ id: data.id, status: data.status });
    },
  })!;
}

export function createMockFintocClient(
  overrides: Partial<FintocTransport> = {}
) {
  const checkoutSessions: (CreateFintocCheckoutSessionInput &
    FintocCheckoutSession)[] = [];
  const refunds: (CreateFintocRefundInput & FintocRefund)[] = [];
  let sequence = 0;

  return Object.freeze({
    createCheckoutSession: async (input: CreateFintocCheckoutSessionInput) => {
      if (overrides.createCheckoutSession) {
        return overrides.createCheckoutSession(input);
      }
      sequence += 1;
      const session = Object.freeze({
        ...input,
        id: `cs_mock_${sequence}`,
        redirectUrl: `https://pay.fintoc.com/checkout/cs_mock_${sequence}`,
      });
      checkoutSessions.push(session);
      return session;
    },
    createRefund: async (input: CreateFintocRefundInput) => {
      if (overrides.createRefund) {
        return overrides.createRefund(input);
      }
      sequence += 1;
      const refund = Object.freeze({
        ...input,
        id: `re_mock_${sequence}`,
        status: "succeeded",
      });
      refunds.push(refund);
      return refund;
    },
    listCheckoutSessions: () => Object.freeze([...checkoutSessions]),
    listRefunds: () => Object.freeze([...refunds]),
  });
}
