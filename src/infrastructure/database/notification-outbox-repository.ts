import "server-only";

import type {
  NotificationDeliveryOutbox,
  NotificationOutboxIntent,
  NotificationOutboxWriter,
} from "@/features/notifications";
import { getServerEnvironment } from "@/config/server";
import { notificationOutbox } from "@/persistence/schema";
import { and, eq, inArray, lte, or, sql } from "drizzle-orm";

import type {
  ProductionDatabase,
  ProductionDatabaseTransaction,
} from "./client";

type NotificationInsert = Readonly<{
  idempotencyKey: string;
  payload: Record<string, string>;
  quotationId?: string;
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
  tx: ProductionDatabaseTransaction,
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
): NotificationOutboxWriter<ProductionDatabaseTransaction> {
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
          quotationId: quotation.id,
          recipient: quotation.email,
          type: "company_quotation_customer",
        },
        {
          idempotencyKey: `company-quotation:${quotation.id}:admin`,
          payload: { quotationId: quotation.id },
          quotationId: quotation.id,
          recipient: adminRecipient,
          type: "company_quotation_admin",
        },
      ]);
    },
  });
}

type OutboxRow = typeof notificationOutbox.$inferSelect;

function toIntent(row: OutboxRow): NotificationOutboxIntent {
  const type = row.type as NotificationOutboxIntent["type"];
  return Object.freeze({
    attempts: row.attempts,
    createdAt: row.createdAt,
    deliveredAt: row.deliveredAt ?? undefined,
    id: row.id,
    lastErrorCode: row.lastError ?? undefined,
    nextAttemptAt: row.nextAttemptAt ?? undefined,
    paymentId:
      typeof row.payload === "object" && row.payload
        ? ((row.payload as Record<string, unknown>).paymentId as
            | string
            | undefined)
        : undefined,
    quotationId: row.quotationId ?? undefined,
    recipient: row.recipient,
    reservationId: row.reservationId ?? undefined,
    status: row.status,
    type,
  });
}

/**
 * PostgreSQL claim/update adapter. Claiming uses one conditional UPDATE, so
 * concurrent schedulers can list the same row but only one reaches delivery.
 */
export function createDrizzleNotificationDeliveryOutbox(
  db: ProductionDatabase,
  types?: readonly NotificationOutboxIntent["type"][]
): NotificationDeliveryOutbox {
  const typeFilter =
    types && types.length > 0
      ? inArray(notificationOutbox.type, [...types])
      : undefined;
  const readyCondition = (now: Date) =>
    and(
      or(
        eq(notificationOutbox.status, "pending"),
        and(
          eq(notificationOutbox.status, "retrying"),
          lte(notificationOutbox.nextAttemptAt, now)
        )
      ),
      typeFilter
    );
  return Object.freeze({
    listReady: async (now) =>
      Object.freeze(
        (
          await db
            .select()
            .from(notificationOutbox)
            .where(readyCondition(now))
            .orderBy(notificationOutbox.createdAt)
        ).map(toIntent)
      ),
    startDelivery: async (id, now) => {
      const [claimed] = await db
        .update(notificationOutbox)
        .set({
          attempts: sql`${notificationOutbox.attempts} + 1`,
          lastError: null,
          nextAttemptAt: null,
          status: "processing",
          updatedAt: now,
        })
        .where(and(eq(notificationOutbox.id, id), readyCondition(now)))
        .returning();
      return claimed ? toIntent(claimed) : null;
    },
    completeDelivery: async (id, now) => {
      const [delivered] = await db
        .update(notificationOutbox)
        .set({ deliveredAt: now, status: "delivered", updatedAt: now })
        .where(
          and(
            eq(notificationOutbox.id, id),
            eq(notificationOutbox.status, "processing")
          )
        )
        .returning();
      if (!delivered) throw new Error("Notification delivery unavailable");
      return toIntent(delivered);
    },
    failDelivery: async (id, input) => {
      const status = input.retryAt ? "retrying" : "failed";
      const [failed] = await db
        .update(notificationOutbox)
        .set({
          lastError: input.errorCode,
          nextAttemptAt: input.retryAt ?? null,
          status,
          updatedAt: input.now,
        })
        .where(
          and(
            eq(notificationOutbox.id, id),
            eq(notificationOutbox.status, "processing")
          )
        )
        .returning();
      if (!failed) throw new Error("Notification delivery unavailable");
      return toIntent(failed);
    },
  });
}
