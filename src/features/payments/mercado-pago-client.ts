import "server-only";

import { getServerEnvironment } from "@/config/server";

const MERCADO_PAGO_API_BASE_URL = "https://api.mercadopago.com";

export type CreateMercadoPagoPreferenceInput = Readonly<{
  amountClp: number;
  cancelUrl: string;
  customerEmail?: string;
  /** The preference dies at this instant (see `add-mercado-pago-checkout-pro` design.md decision 6) — matches the hold's own `expiresAt`. */
  expiresAt: Date;
  /** Echoed back verbatim on the resulting payment (see `MercadoPagoPayment.externalReference`), used to correlate the webhook. */
  externalReference: string;
  successUrl: string;
}>;

export type MercadoPagoPreference = Readonly<{
  id: string;
  initPoint: string;
}>;

export type MercadoPagoPaymentStatus =
  | "pending"
  | "approved"
  | "authorized"
  | "in_process"
  | "in_mediation"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back";

export type MercadoPagoPayment = Readonly<{
  externalReference?: string;
  id: string;
  status: MercadoPagoPaymentStatus;
}>;

/**
 * `kind: "permanent"` (a 4xx from Mercado Pago, e.g. invalid amount) means
 * retrying the same request will not help; `"transient"` (network failure
 * or 5xx) means it might — mirrors `FintocApiError`.
 */
export class MercadoPagoApiError extends Error {
  constructor(
    readonly kind: "permanent" | "transient",
    message = "Mercado Pago API request failed"
  ) {
    super(message);
  }
}

export type MercadoPagoTransport = Readonly<{
  createPreference: (
    input: CreateMercadoPagoPreferenceInput
  ) => Promise<MercadoPagoPreference>;
  getPayment: (paymentId: string) => Promise<MercadoPagoPayment>;
}>;

export type MercadoPagoClient = MercadoPagoTransport;

function mercadoPagoErrorKind(status: number): "permanent" | "transient" {
  return status >= 500 ? "transient" : "permanent";
}

/** Typed server-only boundary for Mercado Pago; production wiring requires an injected transport (see `getFintocClient` for the same pattern). */
export function createMercadoPagoClient(
  transport: MercadoPagoTransport | null
): MercadoPagoClient | null {
  if (!transport) return null;
  return Object.freeze({
    createPreference: async (input) => {
      try {
        return await transport.createPreference(input);
      } catch (error) {
        if (error instanceof MercadoPagoApiError) throw error;
        throw new MercadoPagoApiError("transient");
      }
    },
    getPayment: async (paymentId) => {
      try {
        return await transport.getPayment(paymentId);
      } catch (error) {
        if (error instanceof MercadoPagoApiError) throw error;
        throw new MercadoPagoApiError("transient");
      }
    },
  });
}

/** Always returns a usable client: the mock branch never returns null, and the production branch always supplies a transport (see `getFintocClient`). */
export function getMercadoPagoClient(): MercadoPagoClient {
  const environment = getServerEnvironment();
  if (environment.VISTA_VALLE_CONFIG_CONTEXT === "mock") {
    return createMockMercadoPagoClient();
  }
  return createMercadoPagoClient({
    createPreference: async (input) => {
      const response = await fetch(
        `${MERCADO_PAGO_API_BASE_URL}/checkout/preferences`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${environment.MERCADO_PAGO_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            items: [
              {
                title: "Reserva Vista Valle",
                quantity: 1,
                currency_id: "CLP",
                unit_price: input.amountClp,
              },
            ],
            ...(input.customerEmail
              ? { payer: { email: input.customerEmail } }
              : {}),
            back_urls: {
              success: input.successUrl,
              failure: input.cancelUrl,
              pending: input.successUrl,
            },
            auto_return: "approved",
            external_reference: input.externalReference,
            expires: true,
            date_of_expiration: input.expiresAt.toISOString(),
            payment_methods: {
              installments: 1,
              default_installments: 1,
            },
          }),
        }
      );
      if (!response.ok) {
        throw new MercadoPagoApiError(mercadoPagoErrorKind(response.status));
      }
      const data = (await response.json()) as {
        id: string;
        init_point: string;
      };
      return Object.freeze({ id: data.id, initPoint: data.init_point });
    },
    getPayment: async (paymentId) => {
      const response = await fetch(
        `${MERCADO_PAGO_API_BASE_URL}/v1/payments/${paymentId}`,
        {
          headers: {
            Authorization: `Bearer ${environment.MERCADO_PAGO_ACCESS_TOKEN}`,
          },
        }
      );
      if (!response.ok) {
        throw new MercadoPagoApiError(mercadoPagoErrorKind(response.status));
      }
      const data = (await response.json()) as {
        id: number | string;
        status: string;
        external_reference?: string;
      };
      return Object.freeze({
        externalReference: data.external_reference,
        id: String(data.id),
        status: data.status as MercadoPagoPaymentStatus,
      });
    },
  })!;
}

export function createMockMercadoPagoClient(
  overrides: Partial<MercadoPagoTransport> = {}
) {
  const preferences: (CreateMercadoPagoPreferenceInput &
    MercadoPagoPreference)[] = [];
  const paymentsById = new Map<string, MercadoPagoPayment>();
  let sequence = 0;

  return Object.freeze({
    createPreference: async (input: CreateMercadoPagoPreferenceInput) => {
      if (overrides.createPreference) {
        return overrides.createPreference(input);
      }
      sequence += 1;
      const preference = Object.freeze({
        ...input,
        id: `mp_pref_mock_${sequence}`,
        initPoint: `https://www.mercadopago.cl/checkout/v1/redirect?pref_id=mp_pref_mock_${sequence}`,
      });
      preferences.push(preference);
      return preference;
    },
    getPayment: async (paymentId: string) => {
      if (overrides.getPayment) {
        return overrides.getPayment(paymentId);
      }
      const payment = paymentsById.get(paymentId);
      if (!payment) {
        throw new MercadoPagoApiError("permanent", "Unknown mock payment id");
      }
      return payment;
    },
    listPreferences: () => Object.freeze([...preferences]),
    /** Test-only seam: registers what `getPayment` should return for a given id. */
    seedPayment: (payment: MercadoPagoPayment) => {
      paymentsById.set(payment.id, payment);
    },
  });
}
