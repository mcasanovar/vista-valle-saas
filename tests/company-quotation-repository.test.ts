import { describe, expect, it } from "vitest";

import {
  calculateCompanyQuotation,
  createMockCompanyQuotationRepository,
  normalizeCompanyQuotationInput,
} from "@/features/company-quotations";
import { mockDemoRooms } from "@/features/rooms";

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

describe("company quotation repository", () => {
  it("persists snapshots and returns the same record for an idempotency key", async () => {
    const repository = createMockCompanyQuotationRepository();
    const first = await repository.create(quotation, "quote-request-1");
    const repeated = await repository.create(quotation, "quote-request-1");

    expect(repeated.id).toBe(first.id);
    expect(repeated.lines[0]).toMatchObject({
      capacity: 1,
      nightlyPriceClp: 55000,
      quantity: 2,
    });
    await expect(repository.getById(first.id)).resolves.toMatchObject({
      totalClp: 330000,
    });
    await expect(repository.list()).resolves.toHaveLength(1);
  });
});
