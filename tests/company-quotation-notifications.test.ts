import { describe, expect, it } from "vitest";

import {
  calculateCompanyQuotation,
  createMockCompanyQuotationRepository,
  normalizeCompanyQuotationInput,
} from "@/features/company-quotations";
import {
  createMockNotificationOutbox,
  createMockResendEmailAdapter,
  createNotificationDeliveryWorker,
} from "@/features/notifications";
import { mockDemoRooms } from "@/features/rooms";

describe("company quotation notifications", () => {
  it("creates two idempotent intents and renders customer/admin summaries", async () => {
    const quotation = calculateCompanyQuotation(
      normalizeCompanyQuotationInput({
        checkIn: "2026-10-05",
        checkOut: "2026-10-08",
        company: "Empresa demo",
        contact: "Ana Pérez",
        email: "ana@example.com",
        guestCount: 2,
        message: "Mensaje privado",
        requirements: "Requisitos privados",
        rooms: [{ quantity: 2, slug: "habitacion-valle-demo" }],
      }),
      mockDemoRooms
    );
    const quotationRepository = createMockCompanyQuotationRepository();
    const record = await quotationRepository.create(
      quotation,
      "notification-quote-1"
    );
    const outbox = createMockNotificationOutbox();
    await outbox.writeCompanyQuotationRequested(undefined, {
      quotation: record,
    });
    await outbox.writeCompanyQuotationRequested(undefined, {
      quotation: record,
    });

    const adapter = createMockResendEmailAdapter();
    const worker = createNotificationDeliveryWorker(outbox, adapter, {
      getReservationEmailData: async () => null,
      getCompanyQuotationEmailData: async (id) =>
        quotationRepository.getById(id),
    });
    await worker.processReady();
    await worker.processReady();

    expect(outbox.list()).toHaveLength(2);
    expect(outbox.list().every((intent) => intent.status === "delivered")).toBe(
      true
    );
    expect(adapter.listDelivered()).toHaveLength(2);
    expect(
      adapter
        .listDelivered()
        .map((email) => email.subject)
        .sort()
    ).toEqual(["Nueva cotización empresarial", "Tu cotización de Vista Valle"]);
    expect(
      adapter
        .listDelivered()
        .every((email) => email.from === "reservas@vistavalle.cl")
    ).toBe(true);
    expect(
      adapter
        .listDelivered()
        .some((email) => email.html.includes("Mensaje privado"))
    ).toBe(true);
    expect(
      adapter
        .listDelivered()
        .every((email) => !email.html.includes("Cobertura parcial"))
    ).toBe(true);
  });

  it("declares partial coverage in both emails when capacity falls short of guests", async () => {
    const quotation = calculateCompanyQuotation(
      normalizeCompanyQuotationInput({
        checkIn: "2026-10-05",
        checkOut: "2026-10-08",
        company: "Empresa demo",
        contact: "Ana Pérez",
        email: "ana@example.com",
        guestCount: 5,
        message: "Mensaje privado",
        requirements: "Requisitos privados",
        rooms: [{ quantity: 2, slug: "habitacion-valle-demo" }],
      }),
      mockDemoRooms
    );
    const quotationRepository = createMockCompanyQuotationRepository();
    const record = await quotationRepository.create(
      quotation,
      "notification-quote-partial"
    );
    const outbox = createMockNotificationOutbox();
    await outbox.writeCompanyQuotationRequested(undefined, {
      quotation: record,
    });

    const adapter = createMockResendEmailAdapter();
    const worker = createNotificationDeliveryWorker(outbox, adapter, {
      getReservationEmailData: async () => null,
      getCompanyQuotationEmailData: async (id) =>
        quotationRepository.getById(id),
    });
    await worker.processReady();

    const delivered = adapter.listDelivered();
    expect(delivered).toHaveLength(2);
    expect(
      delivered.every((email) => email.html.includes("Cobertura parcial"))
    ).toBe(true);
    expect(
      delivered.every((email) =>
        email.html.includes("cubre a 2 de las 5 personas")
      )
    ).toBe(true);
  });
});
