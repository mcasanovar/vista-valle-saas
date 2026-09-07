import "server-only";

import type { NotificationTemplateDataSource } from "@/features/notifications";
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
  });
}
