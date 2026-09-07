import "server-only";

import { getServerEnvironment } from "@/config/server";

export type DeliveryEmail = Readonly<{
  from?: string;
  html: string;
  idempotencyKey: string;
  recipient: string;
  replyTo?: string;
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

export function classifyResendHttpFailure(status: number): EmailDeliveryError {
  return new EmailDeliveryError(
    status >= 500 ? "transient" : "permanent",
    status >= 500 ? "delivery_transient" : "delivery_permanent"
  );
}

export function shouldUseRealResendDelivery(
  environment: Pick<
    ReturnType<typeof getServerEnvironment>,
    "RESEND_DELIVERY_MODE" | "VISTA_VALLE_CONFIG_CONTEXT"
  >
) {
  return (
    environment.VISTA_VALLE_CONFIG_CONTEXT === "production" &&
    environment.RESEND_DELIVERY_MODE === "real"
  );
}

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
  if (!shouldUseRealResendDelivery(environment)) {
    return createMockResendEmailAdapter();
  }
  return createResendEmailAdapter({
    send: async (email) => {
      const response = await fetch("https://api.resend.com/emails", {
        body: JSON.stringify({
          from: `${environment.RESEND_FROM_NAME} <${email.from ?? environment.RESEND_FROM_EMAIL}>`,
          html: email.html,
          reply_to: email.replyTo,
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
        throw classifyResendHttpFailure(response.status);
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
