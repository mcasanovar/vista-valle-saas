import "server-only";

import type { CompanyQuotationBreakfastCatalog } from "./quotation";

export type CompanyQuotationBreakfastCatalogInput = Readonly<{
  description: string;
  unitPriceClp: number;
}>;

export type CompanyQuotationBreakfastCatalogIssue = Readonly<{
  field: string;
  message: string;
}>;

export class CompanyQuotationBreakfastCatalogInputError extends Error {
  readonly code = "INVALID_COMPANY_QUOTATION_BREAKFAST_CATALOG_INPUT" as const;

  constructor(
    readonly issues: readonly CompanyQuotationBreakfastCatalogIssue[]
  ) {
    super("El catálogo de desayuno no es válido.");
    this.name = "CompanyQuotationBreakfastCatalogInputError";
  }
}

export function normalizeCompanyQuotationBreakfastCatalogInput(
  value: unknown
): CompanyQuotationBreakfastCatalogInput {
  const candidate =
    value && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const issues: CompanyQuotationBreakfastCatalogIssue[] = [];
  const description =
    typeof candidate.description === "string"
      ? candidate.description.trim()
      : "";
  if (!description)
    issues.push({
      field: "description",
      message: "La descripción es obligatoria.",
    });
  const unitPriceClp = candidate.unitPriceClp;
  if (
    typeof unitPriceClp !== "number" ||
    !Number.isSafeInteger(unitPriceClp) ||
    unitPriceClp < 0
  ) {
    issues.push({
      field: "unitPriceClp",
      message: "Indique un precio válido en CLP.",
    });
  }
  if (issues.length)
    throw new CompanyQuotationBreakfastCatalogInputError(Object.freeze(issues));

  return Object.freeze({
    description,
    unitPriceClp: unitPriceClp as number,
  });
}

export type CompanyQuotationBreakfastCatalogRepository = Readonly<{
  get: () => Promise<CompanyQuotationBreakfastCatalog>;
  update: (
    input: CompanyQuotationBreakfastCatalogInput
  ) => Promise<CompanyQuotationBreakfastCatalog>;
}>;

export function createMockCompanyQuotationBreakfastCatalogRepository(
  initial: CompanyQuotationBreakfastCatalog = Object.freeze({
    description:
      "Desayuno continental con café, jugo, pan, mantequilla, mermelada y fruta de estación.",
    unitPriceClp: 8000,
  })
): CompanyQuotationBreakfastCatalogRepository {
  let current = initial;
  return Object.freeze({
    get: async () => current,
    update: async (input) => {
      current = Object.freeze({ ...input });
      return current;
    },
  });
}

const mockBreakfastCatalogRepository =
  createMockCompanyQuotationBreakfastCatalogRepository();

export function getCompanyQuotationBreakfastCatalogRepository(
  context: "mock" | "production"
): CompanyQuotationBreakfastCatalogRepository | null {
  return context === "mock" ? mockBreakfastCatalogRepository : null;
}
