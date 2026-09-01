import "server-only";

import { eq } from "drizzle-orm";

import type {
  CompanyQuotationRepository,
  CompanyQuotationRecord,
} from "@/features/company-quotations";
import { companyQuotationLines, companyQuotations } from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

type QuotationRow = typeof companyQuotations.$inferSelect;

async function withLines(
  db: ProductionDatabase,
  row: QuotationRow
): Promise<CompanyQuotationRecord> {
  const lines = await db
    .select()
    .from(companyQuotationLines)
    .where(eq(companyQuotationLines.quotationId, row.id));

  return Object.freeze({
    capacity: row.capacity,
    checkIn: row.checkIn,
    checkOut: row.checkOut,
    company: row.company,
    contact: row.contact,
    createdAt: row.createdAt,
    email: row.email,
    guestCount: row.guestCount,
    id: row.id,
    lines: Object.freeze(
      lines.map((line) =>
        Object.freeze({
          capacity: line.capacitySnapshot,
          name: line.roomNameSnapshot,
          nightlyPriceClp: line.nightlyPriceClpSnapshot,
          nights: line.nights,
          quantity: line.quantity,
          slug: line.roomSlug,
          subtotalClp: line.subtotalClp,
        })
      )
    ),
    message: row.message,
    nights: row.nights,
    phone: row.phone,
    requirements: row.requirements,
    status: row.status,
    totalClp: row.totalClp,
  });
}

export function createDrizzleCompanyQuotationRepository(
  db: ProductionDatabase
): CompanyQuotationRepository {
  return Object.freeze({
    create: async (quotation, idempotencyKey) => {
      const existing = await db
        .select()
        .from(companyQuotations)
        .where(eq(companyQuotations.idempotencyKey, idempotencyKey))
        .limit(1);
      if (existing[0]) return withLines(db, existing[0]);

      const created = await db.transaction(async (transaction) => {
        const [row] = await transaction
          .insert(companyQuotations)
          .values({
            capacity: quotation.capacity,
            checkIn: quotation.checkIn,
            checkOut: quotation.checkOut,
            company: quotation.company,
            contact: quotation.contact,
            email: quotation.email,
            guestCount: quotation.guestCount,
            idempotencyKey,
            message: quotation.message,
            nights: quotation.nights,
            phone: quotation.phone,
            requirements: quotation.requirements,
            totalClp: quotation.totalClp,
          })
          .returning();
        await transaction.insert(companyQuotationLines).values(
          quotation.lines.map((line) => ({
            capacitySnapshot: line.capacity,
            nightlyPriceClpSnapshot: line.nightlyPriceClp,
            nights: line.nights,
            quantity: line.quantity,
            quotationId: row.id,
            roomNameSnapshot: line.name,
            roomSlug: line.slug,
            subtotalClp: line.subtotalClp,
          }))
        );
        return row;
      });

      return withLines(db, created);
    },
    getById: async (id) => {
      const [row] = await db
        .select()
        .from(companyQuotations)
        .where(eq(companyQuotations.id, id))
        .limit(1);
      return row ? withLines(db, row) : null;
    },
    getByIdempotencyKey: async (idempotencyKey) => {
      const [row] = await db
        .select()
        .from(companyQuotations)
        .where(eq(companyQuotations.idempotencyKey, idempotencyKey))
        .limit(1);
      return row ? withLines(db, row) : null;
    },
    list: async () => {
      const rows = await db.select().from(companyQuotations);
      return Object.freeze(
        await Promise.all(rows.map((row) => withLines(db, row)))
      );
    },
  });
}
