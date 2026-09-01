import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import {
  listAdminReservations,
  type AdminReservationListRow,
} from "@/infrastructure/database/admin-reservation-source";
import type {
  ReservationOrigin,
  ReservationStatus,
} from "@/features/reservations";
import { ReservationsFilterBar } from "@/features/admin/reservations-filter-bar";
import { ReservationsPagination } from "@/features/admin/reservations-pagination";
import { ReservationRow } from "@/features/admin/reservation-row";

const validStatuses: readonly ReservationStatus[] = [
  "confirmed",
  "cancelled",
  "completed",
  "no_show",
];
const validOrigins: readonly ReservationOrigin[] = [
  "website",
  "airbnb",
  "booking",
  "phone",
  "whatsapp",
  "admin",
];

function parseStatus(value?: string): ReservationStatus | undefined {
  return validStatuses.includes(value as ReservationStatus)
    ? (value as ReservationStatus)
    : undefined;
}

function parseOrigin(value?: string): ReservationOrigin | undefined {
  return validOrigins.includes(value as ReservationOrigin)
    ? (value as ReservationOrigin)
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

function statusMeta(status: AdminReservationListRow["status"]) {
  const meta = {
    cancelled: [
      "Cancelada",
      "bg-[var(--admin-reservation-cancelled-background)] text-[var(--admin-reservation-cancelled)]",
    ],
    completed: [
      "Completada",
      "bg-[var(--admin-reservation-confirmed-background)] text-[var(--admin-reservation-confirmed)]",
    ],
    confirmed: [
      "Confirmada",
      "bg-[var(--admin-reservation-confirmed-background)] text-[var(--admin-reservation-confirmed)]",
    ],
    no_show: [
      "No se presentó",
      "bg-[var(--admin-reservation-pending-background)] text-[var(--admin-reservation-pending)]",
    ],
  } as const;
  return meta[status];
}

type SearchParams = Readonly<{
  search?: string;
  checkInFrom?: string;
  checkInTo?: string;
  checkOutFrom?: string;
  checkOutTo?: string;
  status?: string;
  origin?: string;
  page?: string;
}>;

export const dynamic = "force-dynamic";

export default async function ReservationsPage({
  searchParams,
}: Readonly<{ searchParams: Promise<SearchParams> }>) {
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const boundary = createDatabaseBoundary();

  if (boundary.context !== "production") {
    return (
      <section className="space-y-4">
        <h1 className="font-heading text-title">Reservas</h1>
        <p role="status" className="text-muted-foreground">
          Las reservas no están disponibles.
        </p>
      </section>
    );
  }

  const db = createProductionDatabase(boundary);
  const result = await listAdminReservations(db, {
    checkIn:
      query.checkInFrom || query.checkInTo
        ? { from: query.checkInFrom, to: query.checkInTo }
        : undefined,
    checkOut:
      query.checkOutFrom || query.checkOutTo
        ? { from: query.checkOutFrom, to: query.checkOutTo }
        : undefined,
    origin: parseOrigin(query.origin),
    page,
    search: query.search,
    status: parseStatus(query.status),
  });

  const urlSearchParams = new URLSearchParams(
    Object.entries(query).filter(([, value]) => Boolean(value)) as [
      string,
      string,
    ][]
  );

  return (
    <section className="space-y-4">
      <h1 className="font-heading text-title">Reservas</h1>
      <ReservationsFilterBar
        values={{
          checkInFrom: query.checkInFrom,
          checkInTo: query.checkInTo,
          checkOutFrom: query.checkOutFrom,
          checkOutTo: query.checkOutTo,
          origin: query.origin,
          search: query.search,
          status: query.status,
        }}
      />
      {result.rows.length === 0 ? (
        <p role="status" className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          No se encontraron reservas para estos filtros.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#eef0f5] text-left text-[11px] font-bold tracking-[0.04em] text-[var(--admin-neutral)]">
                <th className="px-4 py-3">Huésped</th>
                <th className="px-4 py-3">Habitación(es)</th>
                <th className="px-4 py-3">Entrada</th>
                <th className="px-4 py-3">Salida</th>
                <th className="px-4 py-3">Estado</th>
                <th className="px-4 py-3">Factura</th>
                <th className="px-4 py-3">Pago</th>
                <th className="px-4 py-3">Creada</th>
                <th className="px-4 py-3 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row) => {
                const [label, className] = statusMeta(row.status);
                return (
                  <ReservationRow
                    key={row.id}
                    href={`/admin/reservas/${row.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-semibold text-foreground">
                        {row.guestName}
                      </span>
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
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${className}`}
                      >
                        {label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                          row.invoiceRequested
                            ? "bg-[var(--admin-reservation-confirmed-background)] text-[var(--admin-reservation-confirmed)]"
                            : "bg-muted text-[var(--admin-neutral)]"
                        }`}
                      >
                        {row.invoiceRequested ? "Con factura" : "Sin factura"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                          row.paymentStatus === "paid"
                            ? "bg-[var(--admin-reservation-confirmed-background)] text-[var(--admin-reservation-confirmed)]"
                            : "bg-[var(--admin-reservation-pending-background)] text-[var(--admin-reservation-pending)]"
                        }`}
                      >
                        {row.paymentStatus === "paid" ? "Pagado" : "Pendiente"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {createdAtFormatter.format(row.createdAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-bold">
                      {currency.format(row.totalClp)}
                    </td>
                  </ReservationRow>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ReservationsPagination
        page={result.page}
        pageSize={result.pageSize}
        searchParams={urlSearchParams}
        total={result.total}
      />
    </section>
  );
}
