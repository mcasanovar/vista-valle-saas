import "server-only";

import { getServerEnvironment } from "@/config/server";
import {
  getOperationalAlerts,
  type OperationalAlert,
} from "@/features/admin/operational-alerts";
import {
  getAdminReservationSource,
  type AdminReservation,
} from "@/features/admin/reservations";
import type {
  ReservationOrigin,
  ReservationStatus,
} from "@/features/reservations";
import {
  allOrigins,
  daysBetweenInclusive,
  everyDayOf,
  getAdminDashboardMonthlySummary,
  validStatuses,
  type AdminDashboardChannelBreakdown,
  type AdminDashboardDailySales,
  type AdminDashboardMonthRange,
  type AdminDashboardMonthlySummary as MonthlySummaryCore,
  type AdminDashboardRoomOccupancy,
} from "@/infrastructure/database/admin-dashboard-summary-source";

export type {
  AdminDashboardChannelBreakdown,
  AdminDashboardDailySales,
  AdminDashboardRoomOccupancy,
};
import { listAdminReservations } from "@/infrastructure/database/admin-reservation-source";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDatabaseBoundary } from "@/infrastructure/database/server";

export type AdminDashboardKpis = Readonly<{
  approvedRevenueClp: number;
  validReservationCount: number;
  occupancyPercentage: number;
  openAlerts: number;
}>;

export type AdminRecentReservation = Readonly<{
  amountClp: number;
  checkIn: string;
  checkOut: string;
  guest: string;
  id: string;
  room: string;
  status: ReservationStatus;
}>;

/** A resolved dashboard period: a specific month, or a whole year when `month` is `null`. */
export type AdminDashboardPeriod = Readonly<{
  year: number;
  month: string | null;
}>;

export type AdminDashboardSummary = Readonly<{
  /** The period every field below except `kpis.openAlerts` and `recentReservations` is scoped to. */
  period: AdminDashboardPeriod;
  kpis: AdminDashboardKpis;
  cancelledReservationCount: number;
  noShowReservationCount: number;
  channelBreakdown: readonly AdminDashboardChannelBreakdown[];
  roomOccupancy: readonly AdminDashboardRoomOccupancy[];
  dailySales: readonly AdminDashboardDailySales[];
  /** Global, newest-first - not scoped to `month` (see proposal.md). */
  recentReservations: readonly AdminRecentReservation[];
}>;

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const YEAR_PATTERN = /^\d{4}$/;

function currentMonth(): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    month: "2-digit",
    timeZone: "America/Santiago",
    year: "numeric",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  return `${year}-${month}`;
}

function defaultPeriod(): AdminDashboardPeriod {
  const month = currentMonth();
  return Object.freeze({ month, year: Number(month.slice(0, 4)) });
}

/**
 * Exposed so the page/API route can resolve the same default period even
 * before (or without) a summary. A valid `month` wins over `year` (and
 * determines its own year); a valid `year` alone selects that whole year;
 * neither defaults to the current calendar month.
 */
export function resolveAdminDashboardPeriod(
  params?: Readonly<{ year?: string; month?: string }>
): AdminDashboardPeriod {
  const { month, year } = params ?? {};
  if (month && MONTH_PATTERN.test(month)) {
    return Object.freeze({ month, year: Number(month.slice(0, 4)) });
  }
  if (year && YEAR_PATTERN.test(year)) {
    return Object.freeze({ month: null, year: Number(year) });
  }
  return defaultPeriod();
}

function monthRange(month: string): AdminDashboardMonthRange {
  const [year, monthNumber] = month.split("-");
  const lastDay = new Date(
    Date.UTC(Number(year), Number(monthNumber), 0)
  ).getUTCDate();
  return Object.freeze({
    from: `${month}-01`,
    to: `${month}-${String(lastDay).padStart(2, "0")}`,
  });
}

/** Exposed for direct unit testing; also used by `getSummary` for a year-scoped period. */
export function yearRange(year: number): AdminDashboardMonthRange {
  return Object.freeze({
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  });
}

function periodRange(period: AdminDashboardPeriod): AdminDashboardMonthRange {
  return period.month ? monthRange(period.month) : yearRange(period.year);
}

function normalizeLimit(limit: number) {
  return Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 0;
}

function averageOccupancy(
  roomOccupancy: readonly AdminDashboardRoomOccupancy[]
): number {
  const totals = roomOccupancy.reduce(
    (accumulated, room) => ({
      available: accumulated.available + room.availableNights,
      occupied: accumulated.occupied + room.occupiedNights,
    }),
    { available: 0, occupied: 0 }
  );
  return totals.available === 0
    ? 0
    : Math.round((totals.occupied / totals.available) * 100);
}

/**
 * The administrative source carries its creation timestamp, so the operator
 * sees a deterministic newest-first order without inferring chronology from
 * a lodging date. Kept global (not scoped to the selected month) per
 * proposal.md.
 */
export function selectRecentAdminReservations(
  reservations: readonly AdminReservation[],
  limit: number
): readonly AdminRecentReservation[] {
  const maximum = normalizeLimit(limit);

  return Object.freeze(
    [...reservations]
      .sort(
        (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
      )
      .slice(0, maximum)
      .map((reservation) => {
        return Object.freeze({
          amountClp: reservation.totalClp,
          checkIn: reservation.checkIn,
          checkOut: reservation.checkOut,
          guest: reservation.guestName,
          id: reservation.id,
          room: reservation.room,
          status: reservation.status,
        });
      })
  );
}

// ---- Mock aggregation ------------------------------------------------
//
// Applies the same rules as `admin-dashboard-summary-source.ts` (revenue
// only from approved payments on a confirmed/completed reservation, the
// same per-room inception bound, the same zero-filled channel/day lists) to
// an in-memory ledger instead of SQL, so the mock context and tests stay
// behaviorally aligned with production without needing a database.

export type MockDashboardPayment = Readonly<{
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "cancelled"
    | "refunded"
    | "requires_action";
  amountClp: number;
}>;

export type MockDashboardReservation = Readonly<{
  id: string;
  origin: ReservationOrigin;
  status: ReservationStatus;
  checkIn: string;
  checkOut: string;
  roomId: string;
  payments: readonly MockDashboardPayment[];
}>;

export type MockDashboardRoom = Readonly<{
  id: string;
  name: string;
  active: boolean;
  createdAt: Date;
}>;

function approvedAmount(reservation: MockDashboardReservation): number {
  return reservation.payments
    .filter((payment) => payment.status === "approved")
    .reduce((total, payment) => total + payment.amountClp, 0);
}

function overlapNights(
  checkIn: string,
  checkOut: string,
  range: AdminDashboardMonthRange
): number {
  const exclusiveEnd = new Date(
    Date.parse(`${range.to}T00:00:00Z`) + 86_400_000
  )
    .toISOString()
    .slice(0, 10);
  const start = checkIn > range.from ? checkIn : range.from;
  const end = checkOut < exclusiveEnd ? checkOut : exclusiveEnd;
  if (end <= start) return 0;
  return Math.round(
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
      86_400_000
  );
}

export function aggregateMockMonthlySummary(
  ledger: readonly MockDashboardReservation[],
  rooms: readonly MockDashboardRoom[],
  range: AdminDashboardMonthRange
): MonthlySummaryCore {
  const inRange = ledger.filter(
    (reservation) =>
      reservation.checkIn >= range.from && reservation.checkIn <= range.to
  );
  const validReservations = inRange.filter((reservation) =>
    (validStatuses as readonly string[]).includes(reservation.status)
  );

  const channelBreakdown = allOrigins.map((origin) => {
    const rows = validReservations.filter((row) => row.origin === origin);
    return Object.freeze({
      approvedAmountClp: rows.reduce(
        (total, row) => total + approvedAmount(row),
        0
      ),
      origin,
      reservationCount: rows.length,
    });
  });

  const roomOccupancy = rooms
    .filter((room) => room.active)
    .map((room) => {
      const inception = room.createdAt.toISOString().slice(0, 10);
      const availableFrom = inception > range.from ? inception : range.from;
      const availableNights =
        availableFrom > range.to
          ? 0
          : daysBetweenInclusive(availableFrom, range.to);
      const occupiedNights = validReservations
        .filter((row) => row.roomId === room.id && approvedAmount(row) > 0)
        .reduce(
          (total, row) => total + overlapNights(row.checkIn, row.checkOut, range),
          0
        );
      return Object.freeze({
        availableNights,
        occupancyPercentage:
          availableNights === 0
            ? 0
            : Math.round((occupiedNights / availableNights) * 100),
        occupiedNights,
        roomId: room.id,
        roomName: room.name,
      });
    });

  const dailySales = everyDayOf(range).map((day) => {
    const rows = validReservations.filter((row) => row.checkIn === day);
    return Object.freeze({
      amountClp: rows.reduce((total, row) => total + approvedAmount(row), 0),
      day,
      reservationCount: rows.length,
    });
  });

  return Object.freeze({
    approvedRevenueClp: validReservations.reduce(
      (total, row) => total + approvedAmount(row),
      0
    ),
    cancelledReservationCount: inRange.filter(
      (row) => row.status === "cancelled"
    ).length,
    channelBreakdown: Object.freeze(channelBreakdown),
    dailySales: Object.freeze(dailySales),
    noShowReservationCount: inRange.filter((row) => row.status === "no_show")
      .length,
    roomOccupancy: Object.freeze(roomOccupancy),
    validReservationCount: validReservations.length,
  });
}

const defaultMockRoom: MockDashboardRoom = Object.freeze({
  active: true,
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  id: "room-valle",
  name: "Habitación Valle",
});

const defaultMockLedger: readonly MockDashboardReservation[] = Object.freeze([
  Object.freeze({
    checkIn: "2026-10-05",
    checkOut: "2026-10-08",
    id: "reservation-demo",
    origin: "website",
    payments: Object.freeze([
      Object.freeze({ amountClp: 1, status: "pending" }),
    ]),
    roomId: "room-valle",
    status: "confirmed",
  }),
]);

type AdminDashboardDependencies = Readonly<{
  listAlerts: () => Promise<readonly OperationalAlert[]>;
  listMonthlyLedger: () => readonly MockDashboardReservation[];
  listRecentReservations: () => readonly AdminReservation[];
  listRooms: () => readonly MockDashboardRoom[];
}>;

const dashboardDependencies: AdminDashboardDependencies = Object.freeze({
  listAlerts: async () => (await getOperationalAlerts()) ?? [],
  listMonthlyLedger: () => defaultMockLedger,
  listRecentReservations: () => getAdminReservationSource()?.list() ?? [],
  listRooms: () => [defaultMockRoom],
});

function toSummary(
  period: AdminDashboardPeriod,
  core: MonthlySummaryCore,
  openAlerts: number,
  recentReservations: readonly AdminRecentReservation[]
): AdminDashboardSummary {
  return Object.freeze({
    cancelledReservationCount: core.cancelledReservationCount,
    channelBreakdown: core.channelBreakdown,
    dailySales: core.dailySales,
    kpis: Object.freeze({
      approvedRevenueClp: core.approvedRevenueClp,
      occupancyPercentage: averageOccupancy(core.roomOccupancy),
      openAlerts,
      validReservationCount: core.validReservationCount,
    }),
    noShowReservationCount: core.noShowReservationCount,
    period,
    recentReservations,
    roomOccupancy: core.roomOccupancy,
  });
}

export function createAdminDashboardSource(
  context: "mock" | "production",
  dependencies: AdminDashboardDependencies = dashboardDependencies
) {
  if (context === "production") {
    const boundary = createDatabaseBoundary();
    if (boundary.context !== "production") return null;
    const db = createProductionDatabase(boundary);

    const getSummary = async (
      period: AdminDashboardPeriod = resolveAdminDashboardPeriod(),
      recentLimit = 5
    ): Promise<AdminDashboardSummary> => {
      const [core, alerts, recent] = await Promise.all([
        getAdminDashboardMonthlySummary(db, periodRange(period)),
        getOperationalAlerts(),
        listAdminReservations(db, { page: 1, pageSize: recentLimit }),
      ]);

      return toSummary(
        period,
        core,
        alerts.length,
        Object.freeze(
          recent.rows.map((row) =>
            Object.freeze({
              amountClp: row.totalClp,
              checkIn: row.checkIn,
              checkOut: row.checkOut,
              guest: row.guestName,
              id: row.id,
              room: row.rooms.join(", "),
              status: row.status,
            })
          )
        )
      );
    };

    return Object.freeze({ getSummary });
  }

  if (context !== "mock") return null;

  const getSummary = async (
    period: AdminDashboardPeriod = resolveAdminDashboardPeriod(),
    recentLimit = 5
  ): Promise<AdminDashboardSummary> => {
    const [core, alerts] = await Promise.all([
      Promise.resolve(
        aggregateMockMonthlySummary(
          dependencies.listMonthlyLedger(),
          dependencies.listRooms(),
          periodRange(period)
        )
      ),
      dependencies.listAlerts(),
    ]);

    return toSummary(
      period,
      core,
      alerts.length,
      selectRecentAdminReservations(
        dependencies.listRecentReservations(),
        recentLimit
      )
    );
  };

  return Object.freeze({ getSummary });
}

export async function getAdminDashboardSummary(period?: AdminDashboardPeriod) {
  return (
    (await createAdminDashboardSource(
      getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT
    )?.getSummary(period)) ?? null
  );
}
