"use client";

import {
  BedDouble,
  CalendarCheck2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  RefreshCw,
  ScrollText,
  Share2,
  TrendingUp,
  UserX,
  Wallet,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type {
  AdminDashboardChannelBreakdown,
  AdminDashboardDailySales,
  AdminDashboardRoomOccupancy,
  AdminDashboardSummary,
  AdminRecentReservation,
} from "@/features/admin/dashboard";
import { originIcons, originLabels } from "@/features/admin/origin-icon";

type Props = Readonly<{
  initialSummary: AdminDashboardSummary | null;
  initialMonth: string;
}>;

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
const monthLabel = new Intl.DateTimeFormat("es-CL", {
  month: "long",
  timeZone: "UTC",
  year: "numeric",
});

function formatDate(value: string) {
  return dates.format(new Date(`${value}T12:00:00-04:00`));
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return monthLabel.format(new Date(Date.UTC(year, monthNumber - 1, 1)));
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

function MonthSelector({
  disabled,
  month,
  onChange,
}: Readonly<{
  disabled: boolean;
  month: string;
  onChange: (month: string) => void;
}>) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        aria-label="Mes anterior"
        className="flex size-8 items-center justify-center rounded-lg border border-border bg-card disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onClick={() => onChange(shiftMonth(month, -1))}
        type="button"
      >
        <ChevronLeft aria-hidden="true" className="size-4" />
      </button>
      <span className="min-w-[11ch] text-center text-[13px] font-bold capitalize">
        {formatMonth(month)}
      </span>
      <button
        aria-label="Mes siguiente"
        className="flex size-8 items-center justify-center rounded-lg border border-border bg-card disabled:cursor-not-allowed disabled:opacity-60"
        disabled={disabled}
        onClick={() => onChange(shiftMonth(month, 1))}
        type="button"
      >
        <ChevronRight aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
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
      <div className="grid grid-cols-2 gap-3 tablet:gap-3.5">
        {Array.from({ length: 2 }, (_, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="h-[72px] rounded-xl border border-border bg-card p-3.5"
          >
            <div className="admin-dashboard-shimmer h-3 w-24 rounded" />
            <div className="admin-dashboard-shimmer mt-3 h-5 w-10 rounded" />
          </div>
        ))}
      </div>
      {Array.from({ length: 3 }, (_, sectionIndex) => (
        <div
          key={sectionIndex}
          aria-hidden="true"
          className="rounded-xl border border-border bg-card p-4 laptop:p-5"
        >
          <div className="admin-dashboard-shimmer h-3.5 w-40 rounded" />
          <div className="mt-4 space-y-2.5">
            {Array.from({ length: 3 }, (_, rowIndex) => (
              <div
                key={rowIndex}
                className="admin-dashboard-shimmer h-3.5 w-full rounded"
              />
            ))}
          </div>
        </div>
      ))}
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

function SectionHeading({
  children,
  icon: Icon,
  right,
}: Readonly<{
  children: React.ReactNode;
  icon: LucideIcon;
  right?: React.ReactNode;
}>) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 font-heading text-base font-bold text-[#181d2b]">
        <Icon aria-hidden="true" className="size-4 text-accent" />
        {children}
      </h2>
      {right}
    </div>
  );
}

function MetricBar({
  icon: Icon,
  label,
  percentage,
  primaryValue,
  secondaryValue,
  secondaryAccessibleLabel,
}: Readonly<{
  icon: LucideIcon;
  label: string;
  percentage: number;
  primaryValue: string;
  secondaryValue?: string;
  secondaryAccessibleLabel?: string;
}>) {
  return (
    <li className="space-y-1.5">
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          <Icon aria-hidden="true" className="size-3.5 shrink-0 text-accent" />
          <span className="break-words">{label}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5 text-[13px] font-bold">
          {primaryValue}
          {secondaryValue ? (
            <span
              aria-label={secondaryAccessibleLabel}
              className="rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-bold text-[var(--admin-neutral)]"
            >
              {secondaryValue}
            </span>
          ) : null}
        </span>
      </div>
      <span className="block h-2.5 overflow-hidden rounded-full bg-muted">
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${Math.min(100, Math.max(0, percentage))}%` }}
        />
      </span>
    </li>
  );
}

function ChannelBreakdown({
  rows,
}: Readonly<{ rows: readonly AdminDashboardChannelBreakdown[] }>) {
  const max = Math.max(1, ...rows.map((row) => row.approvedAmountClp));
  return (
    <section className="rounded-xl border border-border bg-card p-4 laptop:p-5">
      <SectionHeading icon={Share2}>Reservas por canal</SectionHeading>
      <ul className="mt-4 space-y-4">
        {rows.map((row) => (
          <MetricBar
            key={row.origin}
            icon={originIcons[row.origin]}
            label={originLabels[row.origin]}
            percentage={(row.approvedAmountClp / max) * 100}
            primaryValue={currency.format(row.approvedAmountClp)}
            secondaryAccessibleLabel={`${row.reservationCount} reservas`}
            secondaryValue={String(row.reservationCount)}
          />
        ))}
      </ul>
    </section>
  );
}

function RoomOccupancy({
  rows,
}: Readonly<{ rows: readonly AdminDashboardRoomOccupancy[] }>) {
  return (
    <section className="rounded-xl border border-border bg-card p-4 laptop:p-5">
      <SectionHeading icon={BedDouble}>Ocupación por habitación</SectionHeading>
      {rows.length === 0 ? (
        <p role="status" className="mt-3.5 text-sm text-muted-foreground">
          No hay habitaciones activas.
        </p>
      ) : (
        <ul className="mt-4 space-y-4">
          {rows.map((room) => (
            <MetricBar
              key={room.roomId}
              icon={BedDouble}
              label={room.roomName}
              percentage={room.occupancyPercentage}
              primaryValue={`${room.occupancyPercentage}%`}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function DailySalesChart({
  days,
}: Readonly<{ days: readonly AdminDashboardDailySales[] }>) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = days.reduce((sum, day) => sum + day.amountClp, 0);
  const max = Math.max(1, ...days.map((day) => day.amountClp));
  const slot = 10;
  const chartWidth = days.length * slot;
  // Sparse day-of-month labels below the bars (every 5th day, plus the
  // first and last) so an admin can tell which day a bar is without having
  // to hover every one of them.
  const labelStep = days.length > 20 ? 5 : days.length > 10 ? 3 : 1;
  const labeledIndexes = new Set<number>([
    ...Array.from(
      { length: Math.ceil(days.length / labelStep) },
      (_, step) => step * labelStep
    ),
    days.length - 1,
  ]);

  return (
    <section className="rounded-xl border border-border bg-card p-4 laptop:p-5">
      <SectionHeading icon={TrendingUp}>Ventas del mes</SectionHeading>
      {total === 0 ? (
        <p role="status" className="mt-3.5 text-sm text-muted-foreground">
          No hay ventas registradas en el mes.
        </p>
      ) : (
        <div className="relative mt-6">
          {hovered !== null ? (
            <div
              className="pointer-events-none absolute bottom-full z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[#181d2b] px-2.5 py-1.5 text-white shadow-lg"
              style={{
                left: `${((hovered + 0.5) / days.length) * 100}%`,
              }}
            >
              <p className="text-[11px] font-semibold text-white/70">
                {formatDate(days[hovered]!.day)}
              </p>
              <p className="text-[13px] font-bold">
                {currency.format(days[hovered]!.amountClp)}
              </p>
              <p className="text-[11px] text-white/70">
                {days[hovered]!.reservationCount}{" "}
                {days[hovered]!.reservationCount === 1
                  ? "reserva"
                  : "reservas"}
              </p>
            </div>
          ) : null}
          <svg
            aria-hidden="true"
            className="h-28 w-full overflow-visible"
            preserveAspectRatio="none"
            viewBox={`0 0 ${chartWidth} 100`}
          >
            <line
              className="stroke-[#eef0f5]"
              strokeWidth={1}
              x1={0}
              x2={chartWidth}
              y1={99}
              y2={99}
            />
            {days.map((day, index) => {
              const barHeight = (day.amountClp / max) * 92;
              return (
                <rect
                  className={
                    hovered === index ? "fill-[#2c3a94]" : "fill-accent"
                  }
                  height={Math.max(barHeight, day.amountClp > 0 ? 1.5 : 0)}
                  key={day.day}
                  rx={1.2}
                  width={slot - 3}
                  x={index * slot + 1.5}
                  y={98 - barHeight}
                />
              );
            })}
          </svg>
          <div className="absolute inset-0 flex">
            {days.map((day, index) => (
              <button
                aria-label={`${formatDate(day.day)}: ${currency.format(
                  day.amountClp
                )}, ${day.reservationCount} ${
                  day.reservationCount === 1 ? "reserva" : "reservas"
                }`}
                className="flex-1"
                key={day.day}
                onBlur={() => setHovered(null)}
                onFocus={() => setHovered(index)}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                type="button"
              />
            ))}
          </div>
          <div aria-hidden="true" className="mt-1.5 flex">
            {days.map((day, index) => (
              <span
                className={`flex-1 text-center text-[10px] font-semibold ${
                  hovered === index ? "text-accent" : "text-muted-foreground"
                }`}
                key={day.day}
              >
                {labeledIndexes.has(index) ? Number(day.day.slice(-2)) : ""}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
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
    {
      icon: Wallet,
      label: "Total ganado",
      value: currency.format(summary.kpis.approvedRevenueClp),
    },
    {
      icon: CalendarCheck2,
      label: "Reservas del mes",
      value: String(summary.kpis.validReservationCount),
    },
    {
      icon: BedDouble,
      label: "Ocupación promedio",
      value: `${summary.kpis.occupancyPercentage}%`,
    },
    {
      icon: CircleAlert,
      label: "Alertas abiertas",
      value: String(summary.kpis.openAlerts),
    },
  ] as const;
  const secondaryCards = [
    {
      icon: XCircle,
      label: "Canceladas",
      value: summary.cancelledReservationCount,
    },
    {
      icon: UserX,
      label: "No se presentaron",
      value: summary.noShowReservationCount,
    },
  ] as const;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 tablet:gap-3.5 laptop:grid-cols-4 laptop:gap-4">
        {cards.map(({ icon: Icon, label, value }) => (
          <article
            key={label}
            className="rounded-xl border border-border bg-card p-3.5 tablet:p-4 laptop:p-[18px]"
          >
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
              <Icon aria-hidden="true" className="size-3.5 shrink-0 text-accent" />
              {label}
            </p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-2">
              <p className="font-heading text-[23px] font-extrabold text-[#181d2b] laptop:text-[26px]">
                {value}
              </p>
            </div>
          </article>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 tablet:gap-3.5">
        {secondaryCards.map(({ icon: Icon, label, value }) => (
          <article
            key={label}
            className="rounded-xl border border-border bg-card p-3.5"
          >
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
              <Icon aria-hidden="true" className="size-3.5 shrink-0 text-accent" />
              {label}
            </p>
            <p className="mt-1.5 font-heading text-xl font-extrabold text-[#181d2b]">
              {value}
            </p>
          </article>
        ))}
      </div>
      <ChannelBreakdown rows={summary.channelBreakdown} />
      <div className="grid gap-3 tablet:gap-3.5 laptop:grid-cols-2">
        <DailySalesChart days={summary.dailySales} />
        <RoomOccupancy rows={summary.roomOccupancy} />
      </div>
      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-[#eef0f5] px-4 py-3.5 laptop:px-5 laptop:py-4">
          <h2 className="flex items-center gap-2 font-heading text-base font-bold text-[#181d2b] laptop:text-[15px]">
            <ScrollText aria-hidden="true" className="size-4 text-accent" />
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

export function AdminDashboardView({ initialSummary, initialMonth }: Props) {
  const [month, setMonth] = useState(initialMonth);
  const [summary, setSummary] = useState(initialSummary);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (targetMonth: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/admin/dashboard?month=${targetMonth}`,
        { cache: "no-store", credentials: "same-origin" }
      );
      if (!response.ok) throw new Error();
      setSummary((await response.json()) as AdminDashboardSummary | null);
    } catch {
      setError("No se pudieron actualizar los datos. Intenta nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => load(month);

  const changeMonth = (nextMonth: string) => {
    setMonth(nextMonth);
    // A plain history update, not `router.replace`: this already refetches
    // client-side, and a Next.js navigation would additionally trigger the
    // route's RSC round-trip (and its `loading.tsx`), fighting this
    // component's own skeleton state.
    window.history.replaceState(null, "", `/admin?month=${nextMonth}`);
    void load(nextMonth);
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
        <div className="mt-3 tablet:hidden">
          <MonthSelector disabled={loading} month={month} onChange={changeMonth} />
        </div>
      </header>
      <div className="hidden items-center justify-between tablet:flex">
        <MonthSelector disabled={loading} month={month} onChange={changeMonth} />
      </div>
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
