import { describe, expect, it } from "vitest";

import {
  calculateCompanyQuotation,
  createMockCompanyQuotationRepository,
  normalizeCompanyQuotationInput,
} from "@/features/company-quotations";
import {
  createMockNotificationOutbox,
  createNotificationDeliveryWorker,
  createScheduledOutboxProcessor,
  EmailDeliveryError,
} from "@/features/notifications";
import { mockDemoRooms } from "@/features/rooms";

describe("scheduled processor as a backstop for a failed immediate delivery attempt", () => {
  it("delivers the failed intent exactly once on retry, without re-delivering the one that already succeeded immediately", async () => {
    const quotation = calculateCompanyQuotation(
      normalizeCompanyQuotationInput({
        checkIn: "2026-10-05",
        checkOut: "2026-10-08",
        company: "Empresa backstop",
        contact: "Ana Pérez",
        email: "ana@example.com",
        guestCount: 2,
        message: "Mensaje",
        breakfastRequested: false,
        requireParking: true,
        rooms: [{ guestCount: 2, quantity: 2, slug: "habitacion-valle-demo" }],
      }),
      mockDemoRooms
    );
    const quotationRepository = createMockCompanyQuotationRepository();
    const record = await quotationRepository.create(
      quotation,
      "retry-backstop-1"
    );
    const outbox = createMockNotificationOutbox();
    const { outboxIds } = await outbox.writeCompanyQuotationRequested(
      undefined,
      { quotation: record }
    );
    const [, adminOutboxId] = outboxIds;

    const delivered: string[] = [];
    const failedOnce = new Set<string>();
    const adapter = Object.freeze({
      deliver: async (email: { idempotencyKey: string }) => {
        if (
          email.idempotencyKey === adminOutboxId &&
          !failedOnce.has(email.idempotencyKey)
        ) {
          failedOnce.add(email.idempotencyKey);
          throw new EmailDeliveryError("transient", "delivery_transient");
        }
        delivered.push(email.idempotencyKey);
      },
    });

    let now = new Date("2032-01-01T00:00:00.000Z");
    const worker = createNotificationDeliveryWorker(
      outbox,
      adapter,
      {
        getReservationEmailData: async () => null,
        getCompanyQuotationEmailData: async (id) =>
          quotationRepository.getById(id),
      },
      () => now
    );
    const processor = createScheduledOutboxProcessor({
      listReady: outbox.listReady,
      now: () => now,
      process: worker,
    });

    // Immediate best-effort attempt, mirroring what the route schedules via after().
    await processor.processByIds(outboxIds);

    expect(delivered).toEqual([outboxIds[0]]);
    expect(outbox.list()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: outboxIds[0], status: "delivered" }),
        expect.objectContaining({ id: adminOutboxId, status: "retrying" }),
      ])
    );

    // The scheduled processor (the external worker's backstop) picks it up later.
    now = new Date(now.getTime() + 61_000);
    await processor.run();

    expect(delivered.sort()).toEqual([...outboxIds].sort());
    expect(
      outbox.list().every((intent) => intent.status === "delivered")
    ).toBe(true);
    expect(
      outbox.list().find((intent) => intent.id === adminOutboxId)?.attempts
    ).toBe(2);
    // Every outbox id was delivered exactly once end to end.
    expect(delivered).toHaveLength(2);
  });
});
