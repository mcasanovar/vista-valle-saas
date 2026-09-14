import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMockNotificationOutbox,
  createMockResendEmailAdapter,
  createNotificationDeliveryWorker,
  EmailDeliveryError,
  notificationEmailTemplateFixture,
  type NotificationTemplateDataSource,
} from "@/features/notifications";
import type {
  GuestRecord,
  PayAtPropertyPayment,
  ReservationRecord,
} from "@/features/reservations";

const reservation: ReservationRecord = Object.freeze({
  chargesClp: 0,
  checkIn: "2052-01-01",
  checkOut: "2052-01-03",
  createdAt: new Date("2051-01-01T00:00:00.000Z"),
  guestCount: 2,
  guestId: "guest-notification",
  id: "reservation-notification",
  nightlyPriceClp: 60000,
  items: Object.freeze([
    Object.freeze({
      chargesClp: 0,
      guestCount: 2,
      nightlyPriceClp: 60000,
      nights: 2,
      roomId: "demo-room-valle",
      subtotalClp: 120000,
    }),
  ]),
  origin: "website",
  paymentMode: "pay_at_property",
  publicId: "VV-NOTIFICATION-DEMO",
  roomId: "demo-room-valle",
  status: "confirmed",
  totalClp: 120000,
  updatedAt: new Date("2051-01-01T00:00:00.000Z"),
});

const payment: PayAtPropertyPayment = Object.freeze({
  amountClp: 120000,
  currency: "CLP",
  externalReference: "private-reference",
  id: "payment-notification",
  mode: "pay_at_property",
  provider: "pay_at_property",
  reservationId: reservation.id,
  status: "pending",
});

const guest: GuestRecord = Object.freeze({
  email: "guest-notification@example.test",
  firstName: "Ana",
  id: "guest-notification",
  lastName: "Pérez",
  phone: "123",
});

const source: NotificationTemplateDataSource = Object.freeze({
  getReservationEmailData: async () => ({
    ...notificationEmailTemplateFixture,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    guestCount: reservation.guestCount,
    origin: reservation.origin,
    publicId: reservation.publicId,
    totalClp: reservation.totalClp,
  }),
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("notification delivery worker", () => {
  it("delivers rendered confirmation intents once without network duplication", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const outbox = createMockNotificationOutbox();
    await outbox.writeReservationConfirmed(undefined, {
      guest,
      payment,
      reservation,
    });
    const adapter = createMockResendEmailAdapter();
    const worker = createNotificationDeliveryWorker(outbox, adapter, source);

    await worker.processReady();
    await worker.processReady();

    expect(adapter.listDelivered()).toHaveLength(2);
    expect(
      adapter
        .listDelivered()
        .every((email) => email.replyTo === "admin@example.test")
    ).toBe(true);
    expect(outbox.list().every((intent) => intent.status === "delivered")).toBe(
      true
    );
    expect(outbox.list().every((intent) => intent.attempts === 1)).toBe(true);
    expect(outbox.listDeliveryRecords()).toHaveLength(2);
    expect(
      renderToStaticMarkup(<span>{adapter.listDelivered()[0]?.html}</span>)
    ).toContain("Reserva confirmada");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("schedules a privacy-safe retry after a transient failure", async () => {
    const outbox = createMockNotificationOutbox();
    await outbox.writePaymentCollected(undefined, { payment, reservation });
    const adapter = createMockResendEmailAdapter(async () => {
      throw new EmailDeliveryError("transient", "delivery_transient");
    });
    const now = new Date("2052-01-01T00:00:00.000Z");
    const worker = createNotificationDeliveryWorker(
      outbox,
      adapter,
      source,
      () => now
    );

    await worker.processReady();

    const intent = outbox.list()[0];
    expect(intent).toMatchObject({
      attempts: 1,
      lastErrorCode: "delivery_transient",
      status: "retrying",
    });
    expect(intent?.nextAttemptAt).toEqual(new Date("2052-01-01T00:01:00.000Z"));
    expect(JSON.stringify(outbox.listDeliveryRecords())).not.toContain(
      "private-reference"
    );
  });

  it("marks a permanent invalid delivery as failed without a retry", async () => {
    const outbox = createMockNotificationOutbox();
    await outbox.writePaymentCollected(undefined, { payment, reservation });
    const adapter = createMockResendEmailAdapter(async () => {
      throw new EmailDeliveryError("permanent", "delivery_permanent");
    });
    const worker = createNotificationDeliveryWorker(outbox, adapter, source);

    await worker.processReady();

    expect(outbox.list()[0]).toMatchObject({
      attempts: 1,
      lastErrorCode: "delivery_permanent",
      status: "failed",
    });
    expect(outbox.list()[0]?.nextAttemptAt).toBeUndefined();
  });
});
