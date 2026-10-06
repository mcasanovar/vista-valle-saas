import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import {
  listAdminCompanyQuotations,
  type AdminCompanyQuotationDeliveryState,
} from "@/infrastructure/database/admin-company-quotation-source";
import { AdminTableRow } from "@/features/admin/admin-table-row";
import { deliveryStateMeta } from "@/features/admin/company-quotation-delivery-state";
import { CompanyQuotationsFilterBar } from "@/features/admin/company-quotations-filter-bar";
import { CompanyQuotationsPagination } from "@/features/admin/company-quotations-pagination";
import { requireAdministrator } from "@/infrastructure/auth/authorization";

const validDeliveryStates: readonly AdminCompanyQuotationDeliveryState[] = [
  "delivered",
  "failed",
  "pending",
];

function parseDeliveryState(
  value?: string
): AdminCompanyQuotationDeliveryState | undefined {
  return validDeliveryStates.includes(
    value as AdminCompanyQuotationDeliveryState
  )
    ? (value as AdminCompanyQuotationDeliveryState)
    : undefined;
}

const currency = new Intl.NumberFormat("es-CL", {
  currency: "CLP",
  maximumFractionDigits: 0,
  style: "currency",
});

const createdAtFormatter = new Intl.DateTimeFormat("es-CL", {
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  month: "2-digit",
  year: "numeric",
});

type SearchParams = Readonly<{
  search?: string;
  checkInFrom?: string;
  checkInTo?: string;
  checkOutFrom?: string;
  checkOutTo?: string;
  deliveryState?: string;
  page?: string;
}>;

export const dynamic = "force-dynamic";

export default async function CompanyQuotationsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  await requireAdministrator();
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const boundary = createDatabaseBoundary();

  if (boundary.context !== "production") {
    return (
      <section className="space-y-4">
        <h1 className="font-heading text-title">Cotizaciones</h1>
        <p role="status" className="text-muted-foreground">
          Las cotizaciones no están disponibles.
        </p>
      </section>
    );
  }

  const db = createProductionDatabase(boundary);
  const result = await listAdminCompanyQuotations(db, {
    checkIn:
      query.checkInFrom || query.checkInTo
        ? { from: query.checkInFrom, to: query.checkInTo }
        : undefined,
    checkOut:
      query.checkOutFrom || query.checkOutTo
        ? { from: query.checkOutFrom, to: query.checkOutTo }
        : undefined,
    deliveryState: parseDeliveryState(query.deliveryState),
    page,
    search: query.search,
  });

  const urlSearchParams = new URLSearchParams(
    Object.entries(query).filter(([, value]) => Boolean(value)) as [
      string,
      string,
    ][]
  );

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-title">Cotizaciones</h1>
      <CompanyQuotationsFilterBar
        values={{
          checkInFrom: query.checkInFrom,
          checkInTo: query.checkInTo,
          checkOutFrom: query.checkOutFrom,
          checkOutTo: query.checkOutTo,
          deliveryState: query.deliveryState,
          search: query.search,
        }}
      />
      {result.rows.length === 0 ? (
        <p
          role="status"
          className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground"
        >
          No se encontraron cotizaciones para estos filtros.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eef0f5] text-left text-[11px] font-bold tracking-[0.04em] text-[var(--admin-neutral)]">
                <th className="px-4 py-3">Empresa</th>
                <th className="px-4 py-3">Contacto</th>
                <th className="px-4 py-3">Habitación(es)</th>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Salida</th>
                <th className="px-4 py-3">Personas</th>
                <th className="px-4 py-3">Correo</th>
                <th className="px-4 py-3">Solicitada</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => {
                const [label, className] = deliveryStateMeta(row.deliveryState);
                return (
                  <AdminTableRow
                    key={row.id}
                    href={`/admin/cotizaciones/${row.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-foreground">
                        {row.company}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.contact}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.rooms.join(", ")}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.checkIn}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.checkOut}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {row.guestCount}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${className}`}
                      >
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {createdAtFormatter.format(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {currency.format(row.totalClp)}
                    </td>
                  </AdminTableRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <CompanyQuotationsPagination
        page={result.page}
        pageSize={result.pageSize}
        searchParams={urlSearchParams}
        total={result.total}
      />
    </section>
  );
}
