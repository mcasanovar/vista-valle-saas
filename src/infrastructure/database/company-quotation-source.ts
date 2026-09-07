import "server-only";

import {
  getCompanyQuotationBreakfastCatalogRepository,
  getCompanyQuotationRepository,
  type CompanyQuotationBreakfastCatalogRepository,
  type CompanyQuotationCreationService,
  type CompanyQuotationRepository,
} from "@/features/company-quotations";
import { getNotificationOutboxWriter } from "@/features/notifications";
import { createProductionDatabase } from "./client";
import { createDrizzleCompanyQuotationBreakfastCatalogRepository } from "./company-quotation-breakfast-catalog-repository";
import {
  createDrizzleCompanyQuotationCreationService,
  createDrizzleCompanyQuotationRepository,
} from "./company-quotation-repository";
import { createDrizzleNotificationOutboxWriter } from "./notification-outbox-repository";
import { createDatabaseBoundary } from "./server";

export function getServerCompanyQuotationRepository(): CompanyQuotationRepository | null {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return getCompanyQuotationRepository("mock");
  }
  return createDrizzleCompanyQuotationRepository(
    createProductionDatabase(boundary)
  );
}

export function getServerCompanyQuotationCreationService(): CompanyQuotationCreationService | null {
  const boundary = createDatabaseBoundary();
  if (boundary.context === "production") {
    const db = createProductionDatabase(boundary);
    return createDrizzleCompanyQuotationCreationService(
      db,
      createDrizzleNotificationOutboxWriter()
    );
  }

  const repository = getCompanyQuotationRepository("mock");
  const writer = getNotificationOutboxWriter<undefined>();
  if (!repository || !writer) return null;
  return Object.freeze({
    create: async (quotation, idempotencyKey) => {
      const record = await repository.create(quotation, idempotencyKey);
      await writer.writeCompanyQuotationRequested(undefined, {
        quotation: record,
      });
      return record;
    },
  });
}

export function getServerCompanyQuotationBreakfastCatalogRepository(): CompanyQuotationBreakfastCatalogRepository | null {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return getCompanyQuotationBreakfastCatalogRepository("mock");
  }
  return createDrizzleCompanyQuotationBreakfastCatalogRepository(
    createProductionDatabase(boundary)
  );
}
