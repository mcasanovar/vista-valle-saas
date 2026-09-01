"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type {
  AdminDashboardSummary,
  AdminRecentReservation,
} from "@/features/admin/dashboard";

type Props = Readonly<{ initialSummary: AdminDashboardSummary | null }>;

const currency = new Intl.NumberFormat("es-CL", {
  currency: "CLP",
  maximumFractionDigits: 0,
  style: "currency",
});
const dates = new Intl.DateTimeFormat("es-CL", {
  day: "numeric",
  month: "short",
  timeZone: "America/Santiago",
});

function formatDate(value: string) {
  return dates.format(new Date(`${value}T12:00:00-04:00`));
}

function statusMeta(status: AdminRecentReservation["status"]) {
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

function StatusBadge({
  status,
}: Readonly<{ status: AdminRecentReservation["status"] }>) {
  const [label, className] = statusMeta(status);
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${className}`}
    >
      {label}
    </span>
  );
}

function Amount({
  amount,
  compact = false,
}: Readonly<{ amount: number | null; compact?: boolean }>) {
  if (amount === null) return <>{compact ? "—" : "Monto no disponible"}</>;
  return <>{currency.format(amount)}</>;
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" className="space-y-5">
      <p role="status" className="sr-only">
        Cargando resumen operativo
      </p>
      <div className="grid grid-cols-2 gap-3 tablet:gap-3.5 laptop:grid-cols-4 laptop:gap-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="h-[104px] rounded-xl border border-border bg-card p-4"
          >
            <div className="admin-dashboard-shimmer h-3 w-20 rounded" />
            <div className="admin-dashboard-shimmer mt-4 h-7 w-24 rounded" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-card p-4 laptop:p-5">
        {Array.from({ length: 3 }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="flex items-center justify-between border-b border-[#f2f3f7] py-3 last:border-0"
          >
            <div>
              <div className="admin-dashboard-shimmer h-3 w-36 rounded" />
              <div className="admin-dashboard-shimmer mt-2 h-3 w-28 rounded" />
            </div>
            <div className="admin-dashboard-shimmer h-5 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function RecentReservations({
  rows,
}: Readonly<{ rows: readonly AdminRecentReservation[] }>) {
  if (rows.length === 0)
    return (
      <p role="status" className="p-5 text-sm text-muted-foreground">
        No hay reservas recientes.
      </p>
    );
  return (
    <>
      <div className="hidden laptop:block">
        <div className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1fr_1fr] border-b border-[#eef0f5] px-5 py-2.5 text-[11px] font-bold tracking-[0.04em] text-[var(--admin-neutral)]">
          <span>HUÉSPED</span>
          <span>HABITACIÓN</span>
          <span>ENTRADA</span>
          <span>SALIDA</span>
          <span>ESTADO</span>
          <span className="text-right">MONTO</span>
        </div>
        {rows.map((row) => (
          <div
            key={row.id}
            className="grid grid-cols-[2fr_1.2fr_1fr_1fr_1fr_1fr] items-center border-b border-[#f2f3f7] px-5 py-3 text-sm last:border-0"
          >
            <span className="font-semibold">{row.guest}</span>
            <span className="text-muted-foreground">{row.room}</span>
            <span className="text-muted-foreground">
              {formatDate(row.checkIn)}
            </span>
            <span className="text-muted-foreground">
              {formatDate(row.checkOut)}
            </span>
            <StatusBadge status={row.status} />
            <span className="text-right font-bold">
              <Amount amount={row.amountClp} />
            </span>
          </div>
        ))}
      </div>
      <div className="hidden tablet:block laptop:hidden">
        {rows.map((row) => (
          <div
            key={row.id}
            className="flex items-center justify-between border-b border-[#f2f3f7] px-[18px] py-[13px] last:border-0"
          >
            <div>
              <p className="text-sm font-semibold">{row.guest}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {row.room} · {formatDate(row.checkIn)} –{" "}
                {formatDate(row.checkOut)}
              </p>
            </div>
            <div className="flex items-center gap-3.5">
              <StatusBadge status={row.status} />
              <span className="w-20 text-right text-sm font-bold">
                <Amount amount={row.amountClp} compact />
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="space-y-2.5 tablet:hidden">
        {rows.map((row) => (
          <article
            key={row.id}
            className="rounded-xl border border-border bg-card p-3.5"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-bold">{row.guest}</h3>
              <StatusBadge status={row.status} />
            </div>
            <p className="mt-2 text-[13px] text-muted-foreground">
              {row.room} · {formatDate(row.checkIn)} –{" "}
              {formatDate(row.checkOut)}
            </p>
            <p className="mt-2 text-base font-bold">
              <Amount amount={row.amountClp} />
            </p>
          </article>
        ))}
      </div>
    </>
  );
}

function SummaryContent({
  summary,
}: Readonly<{ summary: AdminDashboardSummary }>) {
  const cards = [
    ["Ocupación hoy", `${summary.kpis.occupancyPercentage}%`],
    ["Reservas activas", String(summary.kpis.activeReservations)],
    ["Pagos pendientes", currency.format(summary.kpis.pendingPaymentsClp)],
    ["Alertas abiertas", String(summary.kpis.openAlerts)],
  ] as const;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 tablet:gap-3.5 laptop:grid-cols-4 laptop:gap-4">
        {cards.map(([label, value]) => (
          <article
            key={label}
            className="rounded-xl border border-border bg-card p-3.5 tablet:p-4 laptop:p-[18px]"
          >
            <p className="text-[13px] font-semibold text-muted-foreground">
              {label}
            </p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
              <p className="font-heading text-[23px] font-extrabold text-[#181d2b] laptop:text-[26px]">
                {value}
              </p>
              <span className="text-[11px] font-bold text-[var(--admin-neutral)] tablet:text-xs">
                Sin comparación
              </span>
            </div>
          </article>
        ))}
      </div>
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-[#eef0f5] px-4 py-3.5 laptop:px-5 laptop:py-4">
          <h2 className="font-heading text-base font-bold text-[#181d2b] laptop:text-[15px]">
            Reservas recientes
          </h2>
          <Link
            href="/admin/reservas"
            className="min-h-11 content-center text-[13px] font-semibold text-accent"
          >
            Ver todas <span aria-hidden="true">→</span>
          </Link>
        </div>
        <RecentReservations rows={summary.recentReservations} />
      </section>
    </>
  );
}

export function AdminDashboardView({ initialSummary }: Props) {
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/dashboard", {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error();
      setSummary((await response.json()) as AdminDashboardSummary | null);
    } catch {
      setError("No se pudieron actualizar los datos. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <section
      aria-labelledby="admin-dashboard-title"
      className="space-y-4 tablet:space-y-[18px] laptop:space-y-[22px]"
    >
      <header className="-mx-4 -mt-5 bg-[var(--admin-sidebar)] px-4 pb-4 pt-3.5 text-white phone:-mx-6 phone:px-6 tablet:mx-0 tablet:mt-0 tablet:bg-transparent tablet:p-0 tablet:text-foreground">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1
              id="admin-dashboard-title"
              className="font-heading text-[19px] font-extrabold tablet:text-title laptop:text-[22px]"
            >
              Resumen operativo
            </h1>
            <p className="mt-0.5 text-[13px] text-[#9aa1b8] tablet:text-muted-foreground">
              Vista general de la operación
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={loading}
            className="hidden min-h-9 items-center gap-2 rounded-lg bg-accent px-3.5 text-xs font-bold text-on-accent disabled:cursor-not-allowed disabled:opacity-70 tablet:flex laptop:min-h-[38px] laptop:px-4 laptop:text-[13.5px]"
          >
            <RefreshCw
              aria-hidden="true"
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
            {loading ? "Actualizando…" : "Actualizar datos"}
          </button>
        </div>
      </header>
      <button
        type="button"
        onClick={refresh}
        disabled={loading}
        className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[10px] bg-accent px-4 text-base font-bold text-on-accent disabled:cursor-not-allowed disabled:opacity-70 tablet:hidden"
      >
        <RefreshCw
          aria-hidden="true"
          className={`size-3.5 ${loading ? "animate-spin" : ""}`}
        />
        {loading ? "Actualizando…" : "Actualizar datos"}
      </button>
      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-destructive bg-[var(--admin-reservation-cancelled-background)] p-3 text-sm text-destructive"
        >
          {error}
        </p>
      ) : null}
      {loading ? (
        <DashboardSkeleton />
      ) : summary ? (
        <SummaryContent summary={summary} />
      ) : (
        <p
          role="status"
          className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground"
        >
          El resumen operativo no está disponible.
        </p>
      )}
    </section>
  );
}
