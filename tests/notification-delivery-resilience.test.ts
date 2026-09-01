import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createMockResendEmailAdapter,
  createNotificationDeliveryWorker,
  EmailDeliveryError,
  getMockNotificationOutboxRepository,
  getMockNotificationTemplateDataSource,
} from "@/features/notifications";
import {
  confirmPayAtPropertyBooking,
  getMockReservationPaymentAdminViewByPublicId,
} from "@/features/reservations/confirm-pay-at-property";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("notification delivery resilience", () => {
  it("never rolls back a confirmed reservation when the disconnected provider fails, then delivers once after retry", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const confirmation = await confirmPayAtPropertyBooking({
      room: "demo-room-valle",
      checkIn: "2054-01-01",
      checkOut: "2054-01-03",
      firstName: "Ana",
      lastName: "Pérez",
      email: "resilience-guest@example.test",
      phone: "123",
      guestCount: 1,
    });
    const before = await getMockReservationPaymentAdminViewByPublicId(
      confirmation.publicId
    );
    const outbox = getMockNotificationOutboxRepository();
    const source = getMockNotificationTemplateDataSource();
    if (!before || !outbox || !source)
      throw new Error(
        "Mock notification dependencies are required for this test"
      );
    const intent = outbox
      .list()
      .find(
        (item) =>
          item.reservationId === before.id &&
          item.type === "reservation_confirmed_guest"
      );
    if (!intent) throw new Error("Guest notification intent was not created");

    let attempts = 0;
    let currentTime = new Date("2054-01-01T00:00:00.000Z");
    const adapter = createMockResendEmailAdapter(async () => {
      attempts += 1;
      if (attempts === 1)
        throw new EmailDeliveryError("transient", "delivery_transient");
    });
    const worker = createNotificationDeliveryWorker(
      outbox,
      adapter,
      source,
      () => currentTime
    );

    await worker.process(intent.id);

    expect(outbox.getById(intent.id)).toMatchObject({
      attempts: 1,
      lastErrorCode: "delivery_transient",
      status: "retrying",
    });
    expect(
      await getMockReservationPaymentAdminViewByPublicId(confirmation.publicId)
    ).toMatchObject({
      checkIn: before.checkIn,
      checkOut: before.checkOut,
      paymentStatus: "pending",
      status: "confirmed",
    });

    currentTime = new Date("2054-01-01T00:01:00.000Z");
    await worker.process(intent.id);
    await worker.process(intent.id);

    expect(adapter.listDelivered()).toHaveLength(1);
    expect(attempts).toBe(2);
    expect(outbox.getById(intent.id)).toMatchObject({
      attempts: 2,
      status: "delivered",
    });
    expect(
      outbox
        .listDeliveryRecords()
        .filter(
          (record) =>
            record.outboxId === intent.id && record.status === "delivered"
        )
    ).toHaveLength(1);
    expect(JSON.stringify(outbox.listDeliveryRecords())).not.toMatch(
      /resilience-guest|secret|token|externalReference/i
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
