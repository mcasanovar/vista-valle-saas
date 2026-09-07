import "server-only";

import type { ReservationOrigin } from "@/features/reservations";

import {
  renderNewReservationAdminAlertEmail,
  renderPayAtPropertyConfirmationEmail,
  renderPaymentCollectedAdminEmail,
  renderCompanyQuotationAdminEmail,
  renderCompanyQuotationCustomerEmail,
} from "./email-template-renderer";
import type { PayAtPropertyConfirmationEmailData } from "./email-templates";
import type {
  NotificationDeliveryOutbox,
  NotificationOutboxIntent,
} from "./outbox";
import { EmailDeliveryError, type ResendEmailAdapter } from "./resend-adapter";
import { getServerEnvironment } from "@/config/server";
import type { CompanyQuotationEmailData } from "./email-templates";

export type NotificationTemplateDataSource = Readonly<{
  getReservationEmailData: (
    reservationId: string
  ) => Promise<
    | (PayAtPropertyConfirmationEmailData &
        Readonly<{ origin: ReservationOrigin }>)
    | null
  >;
  getCompanyQuotationEmailData?: (
    quotationId: string
  ) => Promise<CompanyQuotationEmailData | null>;
}>;

export type NotificationDeliveryWorker = Readonly<{
  process: (outboxId: string) => Promise<void>;
  processReady: () => Promise<void>;
}>;

function retryAt(now: Date, attempt: number) {
  return new Date(now.getTime() + 60_000 * 2 ** (attempt - 1));
}

async function renderEmail(
  intent: NotificationOutboxIntent,
  source: NotificationTemplateDataSource
): Promise<Pick<import("./resend-adapter").DeliveryEmail, "html" | "subject">> {
  if (
    intent.type === "company_quotation_customer" ||
    intent.type === "company_quotation_admin"
  ) {
    const quotationId = intent.quotationId;
    if (!quotationId || !source.getCompanyQuotationEmailData) {
      throw new EmailDeliveryError("permanent", "delivery_permanent");
    }
    const data = await source.getCompanyQuotationEmailData(quotationId);
    if (!data) throw new EmailDeliveryError("permanent", "delivery_permanent");
    return {
      html:
        intent.type === "company_quotation_customer"
          ? renderCompanyQuotationCustomerEmail(data)
          : renderCompanyQuotationAdminEmail(data),
      subject:
        intent.type === "company_quotation_customer"
          ? "Tu cotización de Vista Valle"
          : "Nueva cotización empresarial",
    };
  }

  if (intent.type === "payment_collected_admin") {
    if (!intent.reservationId) {
      throw new EmailDeliveryError("permanent", "delivery_permanent");
    }
    return {
      html: renderPaymentCollectedAdminEmail(intent.reservationId),
      subject: "Cobro presencial registrado",
    };
  }

  if (!intent.reservationId) {
    throw new EmailDeliveryError("permanent", "delivery_permanent");
  }
  const data = await source.getReservationEmailData(intent.reservationId);
  if (!data) throw new EmailDeliveryError("permanent", "delivery_permanent");
  if (intent.type === "reservation_confirmed_guest") {
    return {
      html: renderPayAtPropertyConfirmationEmail(data),
      subject: "Tu reserva en Vista Valle está confirmada",
    };
  }
  return {
    html: renderNewReservationAdminAlertEmail(data),
    subject: "Nueva reserva confirmada",
  };
}

/** Processes persisted intents only; it has no scheduler or UI responsibility. */
export function createNotificationDeliveryWorker(
  outbox: NotificationDeliveryOutbox,
  adapter: ResendEmailAdapter,
  source: NotificationTemplateDataSource,
  now: () => Date = () => new Date(),
  maxAttempts = 3
): NotificationDeliveryWorker {
  const process = async (outboxId: string) => {
    const started = await outbox.startDelivery(outboxId, now());
    if (!started) return;

    try {
      const rendered = await renderEmail(started, source);
      await adapter.deliver({
        ...rendered,
        from: getServerEnvironment().RESEND_FROM_EMAIL,
        idempotencyKey: started.id,
        recipient: started.recipient,
        replyTo: getServerEnvironment().ADMIN_NOTIFICATION_EMAIL,
      });
      await outbox.completeDelivery(started.id, now());
    } catch (error) {
      const deliveryError =
        error instanceof EmailDeliveryError
          ? error
          : new EmailDeliveryError("transient", "delivery_transient");
      await outbox.failDelivery(started.id, {
        errorCode: deliveryError.safeCode,
        now: now(),
        retryAt:
          deliveryError.kind === "transient" && started.attempts < maxAttempts
            ? retryAt(now(), started.attempts)
            : undefined,
      });
    }
  };

  return Object.freeze({
    process,
    processReady: async () => {
      const ready = await outbox.listReady(now());
      for (const intent of ready) await process(intent.id);
    },
  });
}
