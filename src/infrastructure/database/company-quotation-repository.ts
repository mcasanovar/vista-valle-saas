import "server-only";

import { eq } from "drizzle-orm";

import type {
  CompanyQuotationCreationService,
  CompanyQuotationRepository,
  CompanyQuotationRecord,
} from "@/features/company-quotations";
import type { NotificationOutboxWriter } from "@/features/notifications";
import { companyQuotationLines, companyQuotations } from "@/persistence/schema";
import type {
  ProductionDatabase,
  ProductionDatabaseTransaction,
} from "./client";

type QuotationRow = typeof companyQuotations.$inferSelect;

async function withLines(
  db: Pick<ProductionDatabase, "select">,
  row: QuotationRow
): Promise<CompanyQuotationRecord> {
  const lines = await db
    .select()
    .from(companyQuotationLines)
    .where(eq(companyQuotationLines.quotationId, row.id));

  return Object.freeze({
    breakfastQuantity: row.breakfastQuantity ?? undefined,
    breakfastRequested: row.breakfastRequested,
    breakfastSubtotalClp: row.breakfastSubtotalClp,
    breakfastUnitPriceClp: row.breakfastUnitPriceClpSnapshot ?? undefined,
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
    requireParking: row.requireParking,
    status: row.status,
    totalClp: row.totalClp,
  });
}

async function findByIdempotencyKey(
  db: Pick<ProductionDatabase, "select">,
  idempotencyKey: string
) {
  const [row] = await db
    .select()
    .from(companyQuotations)
    .where(eq(companyQuotations.idempotencyKey, idempotencyKey))
    .limit(1);
  return row;
}

async function insertQuotation(
  transaction: ProductionDatabaseTransaction,
  quotation: CompanyQuotationRecord,
  idempotencyKey: string
) {
  const [row] = await transaction
    .insert(companyQuotations)
    .values({
      breakfastQuantity: quotation.breakfastQuantity ?? null,
      breakfastRequested: quotation.breakfastRequested,
      breakfastSubtotalClp: quotation.breakfastSubtotalClp,
      breakfastUnitPriceClpSnapshot: quotation.breakfastUnitPriceClp ?? null,
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
      requireParking: quotation.requireParking,
      totalClp: quotation.totalClp,
    })
    .onConflictDoNothing({ target: companyQuotations.idempotencyKey })
    .returning();
  if (!row) return null;

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
}

/**
 * Uses exactly one PostgreSQL transaction for quotation snapshots and their
 * notification intents. The writer receives that non-null transaction handle.
 */
export function createDrizzleCompanyQuotationCreationService(
  db: ProductionDatabase,
  notificationOutboxWriter: NotificationOutboxWriter<ProductionDatabaseTransaction>
): CompanyQuotationCreationService {
  return Object.freeze({
    create: (quotation, idempotencyKey) =>
      db.transaction(async (transaction) => {
        const existing = await findByIdempotencyKey(
          transaction,
          idempotencyKey
        );
        if (existing) return withLines(transaction, existing);

        const created = await insertQuotation(
          transaction,
          quotation as CompanyQuotationRecord,
          idempotencyKey
        );
        if (!created) {
          const concurrent = await findByIdempotencyKey(
            transaction,
            idempotencyKey
          );
          if (!concurrent) throw new Error("Company quotation creation failed");
          return withLines(transaction, concurrent);
        }

        const record = await withLines(transaction, created);
        await notificationOutboxWriter.writeCompanyQuotationRequested(
          transaction,
          { quotation: record }
        );
        return record;
      }),
  });
}

export function createDrizzleCompanyQuotationRepository(
  db: ProductionDatabase
): CompanyQuotationRepository {
  return Object.freeze({
    create: async (quotation, idempotencyKey) => {
      const existing = await findByIdempotencyKey(db, idempotencyKey);
      if (existing) return withLines(db, existing);

      const created = await db.transaction(async (transaction) => {
        const [row] = await transaction
          .insert(companyQuotations)
          .values({
            breakfastQuantity: quotation.breakfastQuantity ?? null,
            breakfastRequested: quotation.breakfastRequested,
            breakfastSubtotalClp: quotation.breakfastSubtotalClp,
            breakfastUnitPriceClpSnapshot:
              quotation.breakfastUnitPriceClp ?? null,
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
            requireParking: quotation.requireParking,
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
