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
import {
  renderCompanyQuotationAdminEmail,
  renderCompanyQuotationCustomerEmail,
} from "@/features/notifications/email-template-renderer";
import { mockDemoRooms } from "@/features/rooms";

function textContent(html: string) {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

describe("company quotation notifications", () => {
  it("renders the complete, escaped customer quotation with its confirmation instruction", async () => {
    const quotation = calculateCompanyQuotation(
      normalizeCompanyQuotationInput({
        checkIn: "2026-10-05",
        checkOut: "2026-10-08",
        company: "Empresa <script>alert(1)</script>",
        contact: "Ana <b>Pérez</b>",
        email: "ana@example.com",
        guestCount: 2,
        message: "Mensaje",
        breakfastRequested: false,
        requireParking: true,
        rooms: [{ quantity: 2, slug: "habitacion-valle-demo" }],
      }),
      mockDemoRooms
    );
    const record = await createMockCompanyQuotationRepository().create(
      quotation,
      "notification-customer-renderer"
    );
    const html = renderCompanyQuotationCustomerEmail(record);
    const text = textContent(html);

    expect(html).toMatch(
      /vista-valle-logo-white\.png|Vista Valle Lodging House/
    );
    expect(text).toContain("Entrada");
    expect(text).toContain("2026-10-05");
    expect(text).toContain("Salida");
    expect(text).toContain("2026-10-08");
    expect(text).toContain("2 × Habitación Individual");
    expect(text).toContain("CLP 330.000");
    expect(text).toContain(
      "IMPORTANTE: responde a este mismo correo confirmando los días cotizados para que podamos generar la reserva. Esta cotización no crea una reserva automáticamente."
    );
    expect(html).toContain("Ana &lt;b&gt;Pérez&lt;/b&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(text).not.toContain("Tu reserva está confirmada");
  });

  it("keeps the complete operational snapshot and partial coverage in both quotation emails", async () => {
    const quotation = calculateCompanyQuotation(
      normalizeCompanyQuotationInput({
        checkIn: "2026-10-05",
        checkOut: "2026-10-08",
        company: "Empresa demo",
        contact: "Ana Pérez",
        email: "ana@example.com",
        guestCount: 5,
        message: "Mensaje privado",
        breakfastRequested: false,
        requireParking: true,
        rooms: [{ quantity: 2, slug: "habitacion-valle-demo" }],
      }),
      mockDemoRooms
    );
    const record = await createMockCompanyQuotationRepository().create(
      quotation,
      "notification-admin-renderer"
    );
    const customer = renderCompanyQuotationCustomerEmail(record);
    const admin = renderCompanyQuotationAdminEmail(record);

    expect(textContent(admin)).toContain("Empresa demo");
    expect(textContent(admin)).toContain("Ana Pérez");
    expect(textContent(admin)).toContain("Estacionamiento: Sí");
    expect(textContent(admin)).toContain("Mensaje privado");
    expect(textContent(admin)).toContain("CLP 330.000");
    for (const html of [customer, admin]) {
      expect(textContent(html)).toContain("Cobertura parcial:");
      expect(textContent(html)).toContain(
        "esta cotización cubre a 2 de las 5 personas solicitadas."
      );
      expect(textContent(html)).not.toContain("Tu reserva está confirmada");
    }
  });

  it("includes the breakfast quantity, unit price and subtotal in both emails when requested", async () => {
    const quotation = calculateCompanyQuotation(
      normalizeCompanyQuotationInput({
        breakfastQuantity: 3,
        breakfastRequested: true,
        checkIn: "2026-10-05",
        checkOut: "2026-10-08",
        company: "Empresa demo",
        contact: "Ana Pérez",
        email: "ana@example.com",
        guestCount: 2,
        message: "Mensaje",
        requireParking: false,
        rooms: [{ quantity: 2, slug: "habitacion-valle-demo" }],
      }),
      mockDemoRooms,
      { description: "Desayuno demo", unitPriceClp: 8000 }
    );
    const record = await createMockCompanyQuotationRepository().create(
      quotation,
      "notification-breakfast-renderer"
    );
    const customer = renderCompanyQuotationCustomerEmail(record);
    const admin = renderCompanyQuotationAdminEmail(record);

    for (const html of [customer, admin]) {
      expect(textContent(html)).toContain("3 × Desayuno");
      expect(textContent(html)).toContain("CLP 24.000");
    }
  });

  it("omits any breakfast row when it was not requested", async () => {
    const quotation = calculateCompanyQuotation(
      normalizeCompanyQuotationInput({
        breakfastRequested: false,
        checkIn: "2026-10-05",
        checkOut: "2026-10-08",
        company: "Empresa demo",
        contact: "Ana Pérez",
        email: "ana@example.com",
        guestCount: 2,
        message: "Mensaje",
        requireParking: false,
        rooms: [{ quantity: 2, slug: "habitacion-valle-demo" }],
      }),
      mockDemoRooms
    );
    const record = await createMockCompanyQuotationRepository().create(
      quotation,
      "notification-no-breakfast-renderer"
    );
    expect(
      textContent(renderCompanyQuotationCustomerEmail(record))
    ).not.toContain("Desayuno");
  });

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
        breakfastRequested: false,
        requireParking: true,
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
        breakfastRequested: false,
        requireParking: true,
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
