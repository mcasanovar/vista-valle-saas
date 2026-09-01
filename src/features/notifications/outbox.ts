import "server-only";

import { getServerEnvironment } from "@/config/server";
import type { GuestRecord } from "@/features/reservations";
import type { CompanyQuotationRecord } from "@/features/company-quotations";
import type {
  PayAtPropertyPayment,
  ReservationRecord,
} from "@/features/reservations";

export type NotificationOutboxIntent = Readonly<{
  attempts: number;
  createdAt: Date;
  deliveredAt?: Date;
  id: string;
  lastErrorCode?: string;
  nextAttemptAt?: Date;
  paymentId?: string;
  quotationId?: string;
  recipient: string;
  reservationId?: string;
  status: "delivered" | "failed" | "pending" | "processing" | "retrying";
  type:
    | "payment_collected_admin"
    | "reservation_confirmed_admin"
    | "reservation_confirmed_guest"
    | "company_quotation_customer"
    | "company_quotation_admin";
}>;

export type NotificationDeliveryRecord = Readonly<{
  at: Date;
  attempt: number;
  errorCode?: string;
  outboxId: string;
  status: "delivered" | "failed" | "retrying";
}>;

export type NotificationOutboxWriter<TContext> = Readonly<{
  writePaymentCollected: (
    context: TContext,
    input: Readonly<{
      payment: PayAtPropertyPayment;
      reservation: ReservationRecord;
    }>
  ) => Promise<void>;
  writeReservationConfirmed: (
    context: TContext,
    input: Readonly<{
      guest: GuestRecord;
      payment: PayAtPropertyPayment;
      reservation: ReservationRecord;
    }>
  ) => Promise<void>;
  writeCompanyQuotationRequested: (
    context: TContext,
    input: Readonly<{ quotation: CompanyQuotationRecord }>
  ) => Promise<void>;
}>;

export type NotificationOutboxRepository<TContext> =
  NotificationOutboxWriter<TContext> &
    Readonly<{
      completeDelivery: (id: string, now: Date) => NotificationOutboxIntent;
      failDelivery: (
        id: string,
        input: Readonly<{
          errorCode: string;
          now: Date;
          retryAt?: Date;
        }>
      ) => NotificationOutboxIntent;
      getById: (id: string) => NotificationOutboxIntent | null;
      list: () => readonly NotificationOutboxIntent[];
      listDeliveryRecords: () => readonly NotificationDeliveryRecord[];
      listReady: (now: Date) => readonly NotificationOutboxIntent[];
      startDelivery: (id: string, now: Date) => NotificationOutboxIntent | null;
    }>;

function createIntent(
  input: Omit<
    NotificationOutboxIntent,
    "attempts" | "createdAt" | "id" | "status"
  >
) {
  return Object.freeze({
    ...input,
    attempts: 0,
    createdAt: new Date(),
    id: crypto.randomUUID(),
    status: "pending" as const,
  });
}

export function createMockNotificationOutbox<TContext = unknown>(
  failWrite: (() => boolean) | undefined = undefined
): NotificationOutboxRepository<TContext> {
  const intents: NotificationOutboxIntent[] = [];
  const idempotencyKeys = new Set<string>();

  const addBatch = (
    candidates: readonly Readonly<{
      intent: NotificationOutboxIntent;
      key: string;
    }>[]
  ) => {
    const pending = candidates.filter(
      (candidate) => !idempotencyKeys.has(candidate.key)
    );
    if (pending.length === 0) return;
    if (failWrite?.()) throw new Error("Notification outbox unavailable");
    for (const candidate of pending) {
      idempotencyKeys.add(candidate.key);
      intents.push(candidate.intent);
    }
  };

  const replace = (
    current: NotificationOutboxIntent,
    changes: Partial<NotificationOutboxIntent>
  ) => {
    const next = Object.freeze({ ...current, ...changes });
    intents.splice(intents.indexOf(current), 1, next);
    return next;
  };

  const deliveryRecords: NotificationDeliveryRecord[] = [];

  return Object.freeze({
    writeReservationConfirmed: async (_context, input) => {
      const adminRecipient = getServerEnvironment().ADMIN_NOTIFICATION_EMAIL;
      const recipients = new Set([input.guest.email.trim().toLowerCase()]);
      if (input.reservation.invoiceRequest?.email)
        recipients.add(
          input.reservation.invoiceRequest.email.trim().toLowerCase()
        );
      addBatch([
        ...[...recipients].map((recipient) => ({
          key: `reservation:${input.reservation.id}:guest:${recipient}`,
          intent: createIntent({
            recipient,
            reservationId: input.reservation.id,
            type: "reservation_confirmed_guest",
          }),
        })),
        {
          key: `reservation:${input.reservation.id}:admin`,
          intent: createIntent({
            recipient: adminRecipient,
            reservationId: input.reservation.id,
            type: "reservation_confirmed_admin",
          }),
        },
      ]);
    },
    writeCompanyQuotationRequested: async (_context, input) => {
      const quotation = input.quotation;
      addBatch([
        {
          key: `company-quotation:${quotation.id}:customer`,
          intent: createIntent({
            quotationId: quotation.id,
            recipient: quotation.email,
            type: "company_quotation_customer",
          }),
        },
        {
          key: `company-quotation:${quotation.id}:admin`,
          intent: createIntent({
            quotationId: quotation.id,
            recipient: getServerEnvironment().ADMIN_NOTIFICATION_EMAIL,
            type: "company_quotation_admin",
          }),
        },
      ]);
    },
    writePaymentCollected: async (_context, input) => {
      addBatch([
        {
          key: `payment:${input.payment.id}:admin`,
          intent: createIntent({
            paymentId: input.payment.id,
            recipient: getServerEnvironment().ADMIN_NOTIFICATION_EMAIL,
            reservationId: input.reservation.id,
            type: "payment_collected_admin",
          }),
        },
      ]);
    },
    list: () => Object.freeze([...intents]),
    getById: (id) => intents.find((intent) => intent.id === id) ?? null,
    listReady: (now) =>
      Object.freeze(
        intents.filter(
          (intent) =>
            intent.status === "pending" ||
            (intent.status === "retrying" &&
              (intent.nextAttemptAt?.getTime() ?? 0) <= now.getTime())
        )
      ),
    startDelivery: (id) => {
      const current = intents.find((intent) => intent.id === id);
      if (!current || !["pending", "retrying"].includes(current.status))
        return null;
      return replace(current, {
        attempts: current.attempts + 1,
        lastErrorCode: undefined,
        nextAttemptAt: undefined,
        status: "processing",
      });
    },
    completeDelivery: (id, now) => {
      const current = intents.find((intent) => intent.id === id);
      if (!current || current.status !== "processing")
        throw new Error("Notification delivery unavailable");
      const delivered = replace(current, {
        deliveredAt: now,
        status: "delivered",
      });
      deliveryRecords.push(
        Object.freeze({
          at: now,
          attempt: delivered.attempts,
          outboxId: delivered.id,
          status: "delivered",
        })
      );
      return delivered;
    },
    failDelivery: (id, input) => {
      const current = intents.find((intent) => intent.id === id);
      if (!current || current.status !== "processing")
        throw new Error("Notification delivery unavailable");
      const status = input.retryAt ? "retrying" : "failed";
      const failed = replace(current, {
        lastErrorCode: input.errorCode,
        nextAttemptAt: input.retryAt,
        status,
      });
      deliveryRecords.push(
        Object.freeze({
          at: input.now,
          attempt: failed.attempts,
          errorCode: input.errorCode,
          outboxId: failed.id,
          status,
        })
      );
      return failed;
    },
    listDeliveryRecords: () => Object.freeze([...deliveryRecords]),
  });
}

const mockNotificationOutbox = createMockNotificationOutbox();

export function createNotificationOutboxWriter<TContext>(
  context: "mock" | "production"
): NotificationOutboxWriter<TContext> | null {
  if (context !== "mock") return null;
  return mockNotificationOutbox as NotificationOutboxWriter<TContext>;
}

export function getMockNotificationOutboxRepository() {
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return null;
  return mockNotificationOutbox;
}

export function getNotificationOutboxWriter<
  TContext,
>(): NotificationOutboxWriter<TContext> | null {
  return createNotificationOutboxWriter(
    getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT
  );
}

export function getMockNotificationOutboxIntents() {
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return [];
  return mockNotificationOutbox.list();
}
