import "server-only";

import {
  getCompanyQuotationRepository,
  type CompanyQuotationRepository,
} from "@/features/company-quotations";
import { createProductionDatabase } from "./client";
import { createDrizzleCompanyQuotationRepository } from "./company-quotation-repository";
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
