import { describe, expect, it } from "vitest";

import {
  calculateCompanyQuotation,
  CompanyQuotationInputError,
  normalizeCompanyQuotationInput,
} from "@/features/company-quotations";
import { mockDemoRooms } from "@/features/rooms";

const validInput = {
  breakfastRequested: false,
  checkIn: "2026-10-05",
  checkOut: "2026-10-08",
  company: "Empresa demo",
  contact: "Ana Pérez",
  email: "ana@example.com",
  guestCount: 4,
  message: "Necesitamos alojamiento.",
  phone: "+56 9 1111 1111",
  requireParking: true,
  rooms: [
    { quantity: 2, slug: "habitacion-valle-demo" },
    { quantity: 1, slug: "habitacion-terra-demo" },
  ],
};

const breakfastCatalog = { description: "Desayuno demo", unitPriceClp: 8000 };

describe("company quotation", () => {
  it("normalizes a multi-room request and calculates authoritative line totals", () => {
    const input = normalizeCompanyQuotationInput(validInput);
    const quote = calculateCompanyQuotation(input, mockDemoRooms);

    expect(quote).toMatchObject({ capacity: 4, nights: 3, totalClp: 540000 });
    expect(quote.lines).toEqual([
      expect.objectContaining({
        capacity: 1,
        name: "Habitación Individual",
        nightlyPriceClp: 55000,
        quantity: 2,
        subtotalClp: 330000,
      }),
      expect.objectContaining({
        capacity: 2,
        name: "Habitación Doble",
        nightlyPriceClp: 70000,
        quantity: 1,
        subtotalClp: 210000,
      }),
    ]);
  });

  it("rejects invalid dates, quantities and missing room selections", () => {
    expect(() =>
      normalizeCompanyQuotationInput({
        ...validInput,
        checkIn: "no-date",
        rooms: [],
      })
    ).toThrow(CompanyQuotationInputError);
    expect(() =>
      normalizeCompanyQuotationInput({
        ...validInput,
        rooms: [{ quantity: 0, slug: "habitacion-valle-demo" }],
      })
    ).toThrow(CompanyQuotationInputError);
  });

  it("calculates a partial quotation when total people exceed selected capacity, without rejecting it", () => {
    const input = normalizeCompanyQuotationInput({
      ...validInput,
      guestCount: 5,
    });
    const quote = calculateCompanyQuotation(input, mockDemoRooms);

    expect(quote.guestCount).toBe(5);
    expect(quote.capacity).toBe(4);
  });

  it("does not trust client-provided derived values", () => {
    const input = normalizeCompanyQuotationInput({
      ...validInput,
      guestCount: 2,
      totalClp: 1,
      rooms: [{ quantity: 1, slug: "habitacion-terra-demo" }],
    });
    const quote = calculateCompanyQuotation(input, mockDemoRooms);

    expect(quote.totalClp).toBe(210000);
  });

  it("rejects a request without an explicit parking answer", () => {
    const withoutParking: Record<string, unknown> = { ...validInput };
    delete withoutParking.requireParking;
    expect(() => normalizeCompanyQuotationInput(withoutParking)).toThrow(
      CompanyQuotationInputError
    );
  });

  it("requires a valid quantity when breakfast is requested", () => {
    expect(() =>
      normalizeCompanyQuotationInput({
        ...validInput,
        breakfastRequested: true,
      })
    ).toThrow(CompanyQuotationInputError);
  });

  it("adds the breakfast subtotal, using the provided catalog price, to the total", () => {
    const input = normalizeCompanyQuotationInput({
      ...validInput,
      breakfastQuantity: 3,
      breakfastRequested: true,
    });
    const quote = calculateCompanyQuotation(
      input,
      mockDemoRooms,
      breakfastCatalog
    );

    expect(quote.breakfastSubtotalClp).toBe(24000);
    expect(quote.breakfastUnitPriceClp).toBe(8000);
    expect(quote.totalClp).toBe(540000 + 24000);
  });

  it("rejects a breakfast request when no catalog is available", () => {
    const input = normalizeCompanyQuotationInput({
      ...validInput,
      breakfastQuantity: 1,
      breakfastRequested: true,
    });
    expect(() => calculateCompanyQuotation(input, mockDemoRooms)).toThrow(
      CompanyQuotationInputError
    );
  });
});
