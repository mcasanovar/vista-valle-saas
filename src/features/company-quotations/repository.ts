import "server-only";

import type { CompanyQuotation } from "./quotation";

export type CompanyQuotationRecord = Readonly<
  CompanyQuotation & {
    createdAt: Date;
    id: string;
    status: "accepted" | "delivery_failed" | "delivered";
  }
>;

export type CompanyQuotationRepository = Readonly<{
  create: (
    quotation: CompanyQuotation,
    idempotencyKey: string
  ) => Promise<CompanyQuotationRecord>;
  getById: (id: string) => Promise<CompanyQuotationRecord | null>;
  getByIdempotencyKey: (key: string) => Promise<CompanyQuotationRecord | null>;
  list: () => Promise<readonly CompanyQuotationRecord[]>;
}>;

/**
 * Server-side application boundary for accepting a quotation. Production
 * implementations persist the quotation and notification intents as one unit.
 */
export type CompanyQuotationCreationService = Readonly<{
  create: (
    quotation: CompanyQuotation,
    idempotencyKey: string
  ) => Promise<CompanyQuotationRecord>;
}>;

export function createMockCompanyQuotationRepository(): CompanyQuotationRepository {
  const records: CompanyQuotationRecord[] = [];
  const keys = new Map<string, string>();

  return Object.freeze({
    create: async (quotation, idempotencyKey) => {
      const existingId = keys.get(idempotencyKey);
      if (existingId) {
        return records.find((record) => record.id === existingId)!;
      }

      const record = Object.freeze({
        ...quotation,
        createdAt: new Date(),
        id: crypto.randomUUID(),
        status: "accepted" as const,
      });
      keys.set(idempotencyKey, record.id);
      records.push(record);
      return record;
    },
    getById: async (id) => records.find((record) => record.id === id) ?? null,
    getByIdempotencyKey: async (key) => {
      const id = keys.get(key);
      return id ? (records.find((record) => record.id === id) ?? null) : null;
    },
    list: async () => Object.freeze([...records]),
  });
}

const mockRepository = createMockCompanyQuotationRepository();

export function getCompanyQuotationRepository(
  context: "mock" | "production"
): CompanyQuotationRepository | null {
  return context === "mock" ? mockRepository : null;
}
