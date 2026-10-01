import "server-only";

import { inArray } from "drizzle-orm";

import type { NotificationTemplateDataSource } from "@/features/notifications";
import { rooms } from "@/persistence/schema";
import { createDrizzleCompanyQuotationRepository } from "./company-quotation-repository";
import type { ProductionDatabase } from "./client";

/**
 * Production data boundary for notification rendering. Quotation data is read
 * only from PostgreSQL by its trusted outbox identifier, never from payload
 * fields or a mock repository.
 */
export function createProductionNotificationTemplateDataSource(
  db: ProductionDatabase
): NotificationTemplateDataSource {
  const quotations = createDrizzleCompanyQuotationRepository(db);
  return Object.freeze({
    getReservationEmailData: async () => null,
    getCompanyQuotationEmailData: (quotationId) =>
      quotations.getById(quotationId),
    getRoomNamesByIds: async (roomIds) => {
      if (roomIds.length === 0) return new Map<string, string>();
      // Read straight from `rooms` with no active filter: a room a stay
      // edit removed may well be inactive, and it still needs a name.
      const rows = await db
        .select({ id: rooms.id, name: rooms.name })
        .from(rooms)
        .where(inArray(rooms.id, [...roomIds]));
      return new Map(
        rows.flatMap((row) =>
          row.name ? [[row.id, row.name] as const] : []
        )
      );
    },
  });
}
