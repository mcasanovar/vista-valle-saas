import "server-only";

import { getServerEnvironment } from "@/config/server";

export type DeliveryEmail = Readonly<{
  from?: string;
  html: string;
  idempotencyKey: string;
  recipient: string;
  subject: string;
}>;

export class EmailDeliveryError extends Error {
  constructor(
    readonly kind: "permanent" | "transient",
    readonly safeCode: "delivery_permanent" | "delivery_transient"
  ) {
    super("Email delivery unavailable");
  }
}

export type ResendTransport = Readonly<{
  send: (email: DeliveryEmail) => Promise<void>;
}>;

export type ResendEmailAdapter = Readonly<{
  deliver: (email: DeliveryEmail) => Promise<void>;
}>;

/**
 * Typed server-only boundary for Resend. Production wiring deliberately
 * requires an injected transport; this MVP never falls back to fetch or a
 * browser-visible API key.
 */
export function createResendEmailAdapter(
  transport: ResendTransport | null
): ResendEmailAdapter | null {
  if (!transport) return null;
  return Object.freeze({
    deliver: async (email) => {
      try {
        await transport.send(email);
      } catch (error) {
        if (error instanceof EmailDeliveryError) throw error;
        throw new EmailDeliveryError("transient", "delivery_transient");
      }
    },
  });
}

export function getResendEmailAdapter() {
  const environment = getServerEnvironment();
  if (
    environment.VISTA_VALLE_CONFIG_CONTEXT === "mock" ||
    environment.RESEND_DELIVERY_MODE === "mock"
  ) {
    return createMockResendEmailAdapter();
  }
  return createResendEmailAdapter({
    send: async (email) => {
      const response = await fetch("https://api.resend.com/emails", {
        body: JSON.stringify({
          from: `Vista Valle SpA <${email.from ?? environment.RESEND_FROM_EMAIL}>`,
          html: email.html,
          subject: email.subject,
          to: [email.recipient],
        }),
        headers: {
          Authorization: `Bearer ${environment.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        method: "POST",
      });
      if (!response.ok) {
        throw new EmailDeliveryError(
          response.status >= 500 ? "transient" : "permanent",
          response.status >= 500 ? "delivery_transient" : "delivery_permanent"
        );
      }
    },
  });
}

export function createMockResendEmailAdapter(
  send: (email: DeliveryEmail) => Promise<void> = async () => undefined
) {
  const delivered: DeliveryEmail[] = [];
  return Object.freeze({
    deliver: async (email: DeliveryEmail) => {
      await send(email);
      delivered.push(Object.freeze({ ...email }));
    },
    listDelivered: () => Object.freeze([...delivered]),
  });
}
