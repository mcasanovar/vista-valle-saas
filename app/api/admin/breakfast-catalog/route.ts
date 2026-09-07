import {
  CompanyQuotationBreakfastCatalogInputError,
  normalizeCompanyQuotationBreakfastCatalogInput,
} from "@/features/company-quotations";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { getServerCompanyQuotationBreakfastCatalogRepository } from "@/infrastructure/database/company-quotation-source";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireAdministrator();
  } catch {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  const repository = getServerCompanyQuotationBreakfastCatalogRepository();
  if (!repository) {
    return Response.json(
      { error: "El catálogo de desayuno no está disponible." },
      { status: 503 }
    );
  }
  return Response.json(await repository.get());
}

export async function PUT(request: Request) {
  try {
    await requireAdministrator();
  } catch {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const input = normalizeCompanyQuotationBreakfastCatalogInput(
      await request.json()
    );
    const repository = getServerCompanyQuotationBreakfastCatalogRepository();
    if (!repository) {
      return Response.json(
        { error: "El catálogo de desayuno no está disponible." },
        { status: 503 }
      );
    }
    return Response.json(await repository.update(input));
  } catch (error) {
    if (error instanceof CompanyQuotationBreakfastCatalogInputError) {
      return Response.json(
        { code: error.code, issues: error.issues, message: error.message },
        { status: 400 }
      );
    }
    return Response.json(
      { error: "No pudimos actualizar el catálogo de desayuno." },
      { status: 500 }
    );
  }
}
