import "server-only";

import type { NotificationOutboxWriter } from "@/features/notifications";
import { getServerEnvironment } from "@/config/server";
import { notificationOutbox } from "@/persistence/schema";

import type { ProductionRoomLockTransaction } from "./room-lock";

type NotificationInsert = Readonly<{
  idempotencyKey: string;
  payload: Record<string, string>;
  recipient: string;
  reservationId?: string;
  type: string;
}>;

/**
 * Writes notification intents through the transaction that created the
 * reservation. Payloads intentionally contain only operational identifiers;
 * delivery workers fetch their presentation data from trusted persistence.
 */
async function writeIntents(
  tx: ProductionRoomLockTransaction,
  intents: readonly NotificationInsert[]
) {
  if (intents.length === 0) return;
  await tx
    .insert(notificationOutbox)
    .values([...intents])
    .onConflictDoNothing({ target: notificationOutbox.idempotencyKey });
}

/** Persistent outbox adapter. It must only be used inside a DB transaction. */
export function createDrizzleNotificationOutboxWriter(
  adminRecipient = getServerEnvironment().ADMIN_NOTIFICATION_EMAIL
): NotificationOutboxWriter<ProductionRoomLockTransaction> {
  return Object.freeze({
    writeReservationConfirmed: async (tx, input) => {
      const recipients = new Set([input.guest.email.trim().toLowerCase()]);
      const invoiceEmail = input.reservation.invoiceRequest?.email
        .trim()
        .toLowerCase();
      if (invoiceEmail) recipients.add(invoiceEmail);
      const reservationId = input.reservation.id;

      await writeIntents(tx, [
        ...[...recipients].map((recipient) => ({
          idempotencyKey: `reservation:${reservationId}:guest:${recipient}`,
          payload: { reservationId },
          recipient,
          reservationId,
          type: "reservation_confirmed_guest",
        })),
        {
          idempotencyKey: `reservation:${reservationId}:admin`,
          payload: { reservationId },
          recipient: adminRecipient,
          reservationId,
          type: "reservation_confirmed_admin",
        },
      ]);
    },
    writePaymentCollected: async (tx, input) => {
      await writeIntents(tx, [
        {
          idempotencyKey: `payment:${input.payment.id}:admin`,
          payload: {
            paymentId: input.payment.id,
            reservationId: input.reservation.id,
          },
          recipient: adminRecipient,
          reservationId: input.reservation.id,
          type: "payment_collected_admin",
        },
      ]);
    },
    writeCompanyQuotationRequested: async (tx, input) => {
      const quotation = input.quotation;
      await writeIntents(tx, [
        {
          idempotencyKey: `company-quotation:${quotation.id}:customer`,
          payload: { quotationId: quotation.id },
          recipient: quotation.email,
          type: "company_quotation_customer",
        },
        {
          idempotencyKey: `company-quotation:${quotation.id}:admin`,
          payload: { quotationId: quotation.id },
          recipient: adminRecipient,
          type: "company_quotation_admin",
        },
      ]);
    },
  });
}
