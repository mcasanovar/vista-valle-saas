import "server-only";

import { and, eq, gte, inArray, lte, sql } from "drizzle-orm";

import type { ReservationOrigin } from "@/features/reservations";
import { payments, reservationItems, reservations, rooms } from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

/** Reservation statuses counted as a materialized stay for revenue, channel and occupancy purposes (see design.md decision 3). Also reused by `dashboard.ts`'s mock aggregator so both branches apply the same rule. */
export const validStatuses = ["confirmed", "completed"] as const;

export const allOrigins: readonly ReservationOrigin[] = [
  "website",
  "airbnb",
  "booking",
  "phone",
  "whatsapp",
  "admin",
];

export type AdminDashboardMonthRange = Readonly<{
  /** Inclusive, `YYYY-MM-DD`. */
  from: string;
  /** Inclusive, `YYYY-MM-DD`. */
  to: string;
}>;

export type AdminDashboardChannelBreakdown = Readonly<{
  origin: ReservationOrigin;
  reservationCount: number;
  approvedAmountClp: number;
}>;

export type AdminDashboardRoomOccupancy = Readonly<{
  roomId: string;
  roomName: string;
  occupiedNights: number;
  availableNights: number;
  occupancyPercentage: number;
}>;

export type AdminDashboardDailySales = Readonly<{
  /** `YYYY-MM-DD`. */
  day: string;
  amountClp: number;
  /** Valid (`confirmed`/`completed`) reservations checking in that day, regardless of payment status - shown alongside the amount so a hover can explain a day's activity, not just its revenue. */
  reservationCount: number;
}>;

export type AdminDashboardMonthlySummary = Readonly<{
  approvedRevenueClp: number;
  validReservationCount: number;
  cancelledReservationCount: number;
  noShowReservationCount: number;
  channelBreakdown: readonly AdminDashboardChannelBreakdown[];
  roomOccupancy: readonly AdminDashboardRoomOccupancy[];
  dailySales: readonly AdminDashboardDailySales[];
}>;

/** Also reused by `dashboard.ts`'s mock aggregator to keep both branches' date math identical. */
export function daysBetweenInclusive(fromISO: string, toISO: string): number {
  const from = Date.parse(`${fromISO}T00:00:00Z`);
  const to = Date.parse(`${toISO}T00:00:00Z`);
  return Math.max(0, Math.round((to - from) / 86_400_000) + 1);
}

export function everyDayOf(range: AdminDashboardMonthRange): readonly string[] {
  const days: string[] = [];
  const total = daysBetweenInclusive(range.from, range.to);
  const start = Date.parse(`${range.from}T00:00:00Z`);
  for (let index = 0; index < total; index += 1) {
    days.push(new Date(start + index * 86_400_000).toISOString().slice(0, 10));
  }
  return days;
}

/**
 * Counts reservations checking in during `range` by status, and sums the
 * approved-payment revenue of the valid (`confirmed`/`completed`) ones -
 * see design.md decision 3 for why this is one query instead of joining
 * every metric together.
 */
async function queryReservationCountsAndRevenue(
  db: ProductionDatabase,
  range: AdminDashboardMonthRange
) {
  const checkInInRange = and(
    gte(reservations.checkIn, range.from),
    lte(reservations.checkIn, range.to)
  );

  const [statusRows, [revenueRow]] = await Promise.all([
    db
      .select({
        count: sql<number>`count(*)::int`,
        status: reservations.status,
      })
      .from(reservations)
      .where(checkInInRange)
      .groupBy(reservations.status),
    db
      .select({
        approvedRevenueClp: sql<number>`coalesce(sum(${payments.amountClp}), 0)::int`,
      })
      .from(payments)
      .innerJoin(reservations, eq(payments.reservationId, reservations.id))
      .where(
        and(
          checkInInRange,
          eq(payments.status, "approved"),
          inArray(reservations.status, validStatuses)
        )
      ),
  ]);

  const validReservationCount = statusRows
    .filter((row) => (validStatuses as readonly string[]).includes(row.status))
    .reduce((total, row) => total + row.count, 0);
  const cancelledReservationCount =
    statusRows.find((row) => row.status === "cancelled")?.count ?? 0;
  const noShowReservationCount =
    statusRows.find((row) => row.status === "no_show")?.count ?? 0;

  return {
    approvedRevenueClp: revenueRow?.approvedRevenueClp ?? 0,
    cancelledReservationCount,
    noShowReservationCount,
    validReservationCount,
  };
}

/** Zero-fills every channel with no reservation in `range` so the breakdown never silently drops one (spec scenario "Canal sin reservas en el mes"). */
async function queryChannelBreakdown(
  db: ProductionDatabase,
  range: AdminDashboardMonthRange
): Promise<readonly AdminDashboardChannelBreakdown[]> {
  const rows = await db
    .select({
      approvedAmountClp: sql<number>`coalesce(sum(${payments.amountClp}) filter (where ${payments.status} = 'approved'), 0)::int`,
      origin: reservations.origin,
      reservationCount: sql<number>`count(distinct ${reservations.id})::int`,
    })
    .from(reservations)
    .leftJoin(payments, eq(payments.reservationId, reservations.id))
    .where(
      and(
        gte(reservations.checkIn, range.from),
        lte(reservations.checkIn, range.to),
        inArray(reservations.status, validStatuses)
      )
    )
    .groupBy(reservations.origin);

  const byOrigin = new Map(rows.map((row) => [row.origin, row]));
  return Object.freeze(
    allOrigins.map((origin) =>
      Object.freeze({
        approvedAmountClp: byOrigin.get(origin)?.approvedAmountClp ?? 0,
        origin,
        reservationCount: byOrigin.get(origin)?.reservationCount ?? 0,
      })
    )
  );
}

/**
 * A night counts as occupied only for a `confirmed`/`completed` reservation
 * with at least one approved payment (spec: "Reserva confirmada sin pago
 * aprobado"). Available nights use the room's `createdAt` as a best-effort
 * inception bound, since the schema has no room-status history (design.md
 * decision 4) - a currently inactive room is excluded entirely.
 */
async function queryRoomOccupancy(
  db: ProductionDatabase,
  range: AdminDashboardMonthRange
): Promise<readonly AdminDashboardRoomOccupancy[]> {
  const activeRooms = await db
    .select({ createdAt: rooms.createdAt, id: rooms.id, name: rooms.name })
    .from(rooms)
    .where(eq(rooms.active, true));

  if (activeRooms.length === 0) return Object.freeze([]);

  const exclusiveEnd = new Date(
    Date.parse(`${range.to}T00:00:00Z`) + 86_400_000
  )
    .toISOString()
    .slice(0, 10);

  const occupiedRows = await db
    .select({
      occupiedNights: sql<number>`coalesce(sum(
        greatest(0, least(${reservations.checkOut}::date, ${exclusiveEnd}::date) - greatest(${reservations.checkIn}::date, ${range.from}::date))
      ), 0)::int`,
      roomId: reservationItems.roomId,
    })
    .from(reservationItems)
    .innerJoin(reservations, eq(reservationItems.reservationId, reservations.id))
    .where(
      and(
        inArray(reservations.status, validStatuses),
        sql`${reservations.checkIn} < ${exclusiveEnd}::date`,
        sql`${reservations.checkOut} > ${range.from}::date`,
        sql`exists (
          select 1 from ${payments}
          where ${payments.reservationId} = ${reservations.id}
            and ${payments.status} = 'approved'
        )`
      )
    )
    .groupBy(reservationItems.roomId);

  const occupiedByRoom = new Map(
    occupiedRows.map((row) => [row.roomId, row.occupiedNights])
  );

  return Object.freeze(
    activeRooms.map((room) => {
      const inception = room.createdAt.toISOString().slice(0, 10);
      const availableFrom = inception > range.from ? inception : range.from;
      const availableNights =
        availableFrom > range.to
          ? 0
          : daysBetweenInclusive(availableFrom, range.to);
      const occupiedNights = occupiedByRoom.get(room.id) ?? 0;
      return Object.freeze({
        availableNights,
        occupancyPercentage:
          availableNights === 0
            ? 0
            : Math.round((occupiedNights / availableNights) * 100),
        occupiedNights,
        roomId: room.id,
        roomName: room.name ?? "",
      });
    })
  );
}

/** Zero-fills every day of `range` so an empty result is distinguishable from "no data yet" (spec scenario "Mes sin ventas"). */
async function queryDailySales(
  db: ProductionDatabase,
  range: AdminDashboardMonthRange
): Promise<readonly AdminDashboardDailySales[]> {
  const rows = await db
    .select({
      amountClp: sql<number>`coalesce(sum(${payments.amountClp}) filter (where ${payments.status} = 'approved'), 0)::int`,
      day: reservations.checkIn,
      reservationCount: sql<number>`count(distinct ${reservations.id})::int`,
    })
    .from(reservations)
    .leftJoin(payments, eq(payments.reservationId, reservations.id))
    .where(
      and(
        gte(reservations.checkIn, range.from),
        lte(reservations.checkIn, range.to),
        inArray(reservations.status, validStatuses)
      )
    )
    .groupBy(reservations.checkIn);

  const byDay = new Map(rows.map((row) => [row.day, row]));
  return Object.freeze(
    everyDayOf(range).map((day) => {
      const found = byDay.get(day);
      return Object.freeze({
        amountClp: found?.amountClp ?? 0,
        day,
        reservationCount: found?.reservationCount ?? 0,
      });
    })
  );
}

export async function getAdminDashboardMonthlySummary(
  db: ProductionDatabase,
  range: AdminDashboardMonthRange
): Promise<AdminDashboardMonthlySummary> {
  const [counts, channelBreakdown, roomOccupancy, dailySales] =
    await Promise.all([
      queryReservationCountsAndRevenue(db, range),
      queryChannelBreakdown(db, range),
      queryRoomOccupancy(db, range),
      queryDailySales(db, range),
    ]);

  return Object.freeze({
    ...counts,
    channelBreakdown,
    dailySales,
    roomOccupancy,
  });
}
