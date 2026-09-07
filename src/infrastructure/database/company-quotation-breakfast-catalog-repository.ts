import "server-only";

import { asc, eq } from "drizzle-orm";

import type {
  CompanyQuotationBreakfastCatalog,
  CompanyQuotationBreakfastCatalogRepository,
} from "@/features/company-quotations";
import { companyQuotationBreakfastCatalog } from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

const defaultCatalog: CompanyQuotationBreakfastCatalog = Object.freeze({
  description:
    "Desayuno continental con café, jugo, pan, mantequilla, mermelada y fruta de estación.",
  unitPriceClp: 8000,
});

/**
 * The catalog is a single-row table (see design.md decision 3). Migrations
 * stay pure DDL (see tests/migration.test.ts), so the row is created lazily
 * on first access instead of being seeded by a migration INSERT.
 */
export function createDrizzleCompanyQuotationBreakfastCatalogRepository(
  db: ProductionDatabase
): CompanyQuotationBreakfastCatalogRepository {
  const ensureRow = async () => {
    const [row] = await db
      .select({ id: companyQuotationBreakfastCatalog.id })
      .from(companyQuotationBreakfastCatalog)
      .orderBy(asc(companyQuotationBreakfastCatalog.createdAt))
      .limit(1);
    if (row) return row.id;
    const [created] = await db
      .insert(companyQuotationBreakfastCatalog)
      .values(defaultCatalog)
      .returning({ id: companyQuotationBreakfastCatalog.id });
    return created.id;
  };

  return Object.freeze({
    get: async () => {
      const [row] = await db
        .select()
        .from(companyQuotationBreakfastCatalog)
        .orderBy(asc(companyQuotationBreakfastCatalog.createdAt))
        .limit(1);
      if (row)
        return Object.freeze({
          description: row.description,
          unitPriceClp: row.unitPriceClp,
        });
      await ensureRow();
      return defaultCatalog;
    },
    update: async (input) => {
      const id = await ensureRow();
      const [updated] = await db
        .update(companyQuotationBreakfastCatalog)
        .set({
          description: input.description,
          unitPriceClp: input.unitPriceClp,
          updatedAt: new Date(),
        })
        .where(eq(companyQuotationBreakfastCatalog.id, id))
        .returning();
      return Object.freeze({
        description: updated.description,
        unitPriceClp: updated.unitPriceClp,
      });
    },
  });
}
