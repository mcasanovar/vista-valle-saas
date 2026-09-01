import "server-only";

import {
  and,
  desc,
  eq,
  exists,
  gte,
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";

import type {
  ReservationOrigin,
  ReservationStatus,
} from "@/features/reservations";
import {
  auditEvents,
  channelSyncTasks,
  guests,
  paymentEvents,
  payments,
  reservationItems,
  reservations,
  rooms,
} from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

export type AdminReservationDateRangeFilter = Readonly<{
  /** Inclusive lower bound (a single-date filter sets `from === to`). */
  from?: string;
  /** Inclusive upper bound. */
  to?: string;
}>;

export type AdminReservationListFilter = Readonly<{
  /** Free-text search across guest name/email/phone/rut/company, publicId, and room name. Never matches `guestComment`. */
  search?: string;
  checkIn?: AdminReservationDateRangeFilter;
  checkOut?: AdminReservationDateRangeFilter;
  status?: ReservationStatus;
  origin?: ReservationOrigin;
  /** 1-based. */
  page: number;
  /** Defaults to 20. */
  pageSize?: number;
}>;

export type AdminReservationPaymentSummary = "paid" | "pending";

export type AdminReservationListRow = Readonly<{
  id: string;
  publicId: string;
  guestName: string;
  rooms: readonly string[];
  checkIn: string;
  checkOut: string;
  status: ReservationStatus;
  origin: ReservationOrigin;
  totalClp: number;
  createdAt: Date;
  invoiceRequested: boolean;
  paymentStatus: AdminReservationPaymentSummary;
}>;

export type AdminReservationListResult = Readonly<{
  rows: readonly AdminReservationListRow[];
  total: number;
  page: number;
  pageSize: number;
}>;

const DEFAULT_PAGE_SIZE = 20;

function buildListConditions(
  db: ProductionDatabase,
  filter: AdminReservationListFilter
) {
  const conditions = [];
  if (filter.status) conditions.push(eq(reservations.status, filter.status));
  if (filter.origin) conditions.push(eq(reservations.origin, filter.origin));
  if (filter.checkIn?.from)
    conditions.push(gte(reservations.checkIn, filter.checkIn.from));
  if (filter.checkIn?.to)
    conditions.push(lte(reservations.checkIn, filter.checkIn.to));
  if (filter.checkOut?.from)
    conditions.push(gte(reservations.checkOut, filter.checkOut.from));
  if (filter.checkOut?.to)
    conditions.push(lte(reservations.checkOut, filter.checkOut.to));

  const term = filter.search?.trim();
  if (term) {
    const pattern = `%${term}%`;
    conditions.push(
      or(
        ilike(guests.firstName, pattern),
        ilike(guests.lastName, pattern),
        ilike(
          sql`${guests.firstName} || ' ' || ${guests.lastName}`,
          pattern
        ),
        ilike(
          sql`${guests.lastName} || ' ' || ${guests.firstName}`,
          pattern
        ),
        ilike(guests.email, pattern),
        ilike(guests.phone, pattern),
        ilike(guests.rut, pattern),
        ilike(guests.company, pattern),
        ilike(reservations.publicId, pattern),
        exists(
          db
            .select({ one: sql`1` })
            .from(reservationItems)
            .innerJoin(rooms, eq(reservationItems.roomId, rooms.id))
            .where(
              and(
                eq(reservationItems.reservationId, reservations.id),
                ilike(rooms.name, pattern)
              )
            )
        )
      )
    );
  }

  return conditions.length ? and(...conditions) : undefined;
}

/**
 * Two-phase paginated listing (see design.md decision 2): Phase 1 selects
 * only reservation ids under the active filters — one row per reservation,
 * regardless of how many rooms it has — so `LIMIT`/`OFFSET` and the total
 * count are never inflated by a multi-room reservation. Phase 2 then loads
 * the light per-room detail (guest name, room names) only for the ids on
 * this page, where multiple rows per reservation are expected and no
 * longer affect pagination.
 */
export async function listAdminReservations(
  db: ProductionDatabase,
  filter: AdminReservationListFilter
): Promise<AdminReservationListResult> {
  const pageSize = filter.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = Math.max(1, filter.page);
  const offset = (page - 1) * pageSize;
  const where = buildListConditions(db, filter);

  const idRows = await db
    .select({ id: reservations.id })
    .from(reservations)
    .innerJoin(guests, eq(reservations.guestId, guests.id))
    .where(where)
    .orderBy(desc(reservations.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(reservations)
    .innerJoin(guests, eq(reservations.guestId, guests.id))
    .where(where);
  const total = countRow?.count ?? 0;

  const ids = idRows.map((row) => row.id);
  if (ids.length === 0) {
    return Object.freeze({ rows: [], total, page, pageSize });
  }

  const detailRows = await db
    .select({
      checkIn: reservations.checkIn,
      checkOut: reservations.checkOut,
      createdAt: reservations.createdAt,
      firstName: guests.firstName,
      invoiceRequested: reservations.invoiceRequested,
      lastName: guests.lastName,
      origin: reservations.origin,
      publicId: reservations.publicId,
      reservationId: reservations.id,
      roomName: rooms.name,
      status: reservations.status,
      totalClp: reservations.totalClp,
    })
    .from(reservations)
    .innerJoin(guests, eq(reservations.guestId, guests.id))
    .innerJoin(
      reservationItems,
      eq(reservationItems.reservationId, reservations.id)
    )
    .innerJoin(rooms, eq(reservationItems.roomId, rooms.id))
    .where(inArray(reservations.id, ids));

  const paymentRows = await db
    .select({
      reservationId: payments.reservationId,
      status: payments.status,
    })
    .from(payments)
    .where(inArray(payments.reservationId, ids));

  const paymentStatusById = new Map<string, AdminReservationPaymentSummary>();
  for (const payment of paymentRows) {
    if (!payment.reservationId) continue;
    if (payment.status === "approved") {
      paymentStatusById.set(payment.reservationId, "paid");
    } else if (!paymentStatusById.has(payment.reservationId)) {
      paymentStatusById.set(payment.reservationId, "pending");
    }
  }

  const byId = new Map<string, { row: AdminReservationListRow; rooms: string[] }>();
  for (const detail of detailRows) {
    const existing = byId.get(detail.reservationId);
    if (existing) {
      existing.rooms.push(detail.roomName ?? "");
      continue;
    }
    const roomNames = [detail.roomName ?? ""];
    byId.set(detail.reservationId, {
      rooms: roomNames,
      row: {
        checkIn: detail.checkIn,
        checkOut: detail.checkOut,
        createdAt: detail.createdAt,
        guestName: `${detail.firstName} ${detail.lastName}`,
        id: detail.reservationId,
        invoiceRequested: detail.invoiceRequested,
        origin: detail.origin as ReservationOrigin,
        paymentStatus:
          paymentStatusById.get(detail.reservationId) ?? "pending",
        publicId: detail.publicId,
        rooms: roomNames,
        status: detail.status as ReservationStatus,
        totalClp: detail.totalClp,
      },
    });
  }

  const rows = ids
    .map((id) => byId.get(id)?.row)
    .filter((row): row is AdminReservationListRow => Boolean(row));

  return Object.freeze({ rows: Object.freeze(rows), total, page, pageSize });
}

export type AdminReservationDetailItem = Readonly<{
  roomId: string;
  roomName: string;
  nights: number;
  nightlyPriceClp: number;
  chargesClp: number;
  subtotalClp: number;
}>;

export type AdminReservationDetailPayment = Readonly<{
  id: string;
  provider: string;
  providerPaymentId: string | null;
  status: string;
  amountClp: number;
  refundedAmountClp: number;
  paymentMethod: string | null;
  receivedAt: Date | null;
  createdAt: Date;
}>;

export type AdminReservationDetailChannelSync = Readonly<{
  channel: "airbnb" | "booking";
  status: "pending" | "completed";
  completedAt: Date | null;
}>;

export type AdminReservationDetailAuditEvent = Readonly<{
  action: string;
  actorUserId: string | null;
  before: unknown;
  after: unknown;
  occurredAt: Date;
}>;

export type AdminReservationDetail = Readonly<{
  id: string;
  publicId: string;
  status: ReservationStatus;
  origin: ReservationOrigin;
  checkIn: string;
  checkOut: string;
  totalClp: number;
  createdAt: Date;
  guestComment: string | null;
  /** Set only for a reservation created by channel-calendar-sync ingestion; the guest below is then a fixed placeholder, not a real contact. */
  externalPlatform: "airbnb" | "booking" | null;
  guest: Readonly<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    rut: string | null;
    company: string | null;
  }>;
  items: readonly AdminReservationDetailItem[];
  invoiceRequest?: Readonly<{
    name: string;
    rut: string;
    phone: string;
    businessActivity: string;
    email: string;
  }>;
  payments: readonly AdminReservationDetailPayment[];
  channelSyncTasks: readonly AdminReservationDetailChannelSync[];
  auditEvents: readonly AdminReservationDetailAuditEvent[];
}>;

/**
 * Full detail for a single reservation — the "heavy" query (see design.md
 * decision 3). Only ever loaded for one reservation at a time, never as
 * part of the paginated listing.
 */
export async function getAdminReservationDetail(
  db: ProductionDatabase,
  id: string
): Promise<AdminReservationDetail | null> {
  const [reservationRow] = await db
    .select()
    .from(reservations)
    .where(eq(reservations.id, id));
  if (!reservationRow) return null;

  const [guestRow] = await db
    .select()
    .from(guests)
    .where(eq(guests.id, reservationRow.guestId));
  if (!guestRow) return null;

  const [itemRows, paymentRows, channelSyncRows, auditRows] =
    await Promise.all([
      db
        .select({
          chargesClp: reservationItems.chargesClp,
          nightlyPriceClp: reservationItems.nightlyPriceClp,
          nights: reservationItems.nights,
          roomId: reservationItems.roomId,
          roomName: rooms.name,
          subtotalClp: reservationItems.subtotalClp,
        })
        .from(reservationItems)
        .innerJoin(rooms, eq(reservationItems.roomId, rooms.id))
        .where(eq(reservationItems.reservationId, id)),
      db.select().from(payments).where(eq(payments.reservationId, id)),
      db
        .select()
        .from(channelSyncTasks)
        .where(eq(channelSyncTasks.reservationId, id)),
      db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.entityType, "reservation"),
            eq(auditEvents.entityId, id)
          )
        )
        .orderBy(desc(auditEvents.occurredAt)),
    ]);

  return Object.freeze({
    checkIn: reservationRow.checkIn,
    checkOut: reservationRow.checkOut,
    createdAt: reservationRow.createdAt,
    guestComment: reservationRow.guestComment,
    id: reservationRow.id,
    externalPlatform: reservationRow.externalPlatform,
    origin: reservationRow.origin as ReservationOrigin,
    publicId: reservationRow.publicId,
    status: reservationRow.status as ReservationStatus,
    totalClp: reservationRow.totalClp,
    guest: Object.freeze({
      company: guestRow.company,
      email: guestRow.email,
      firstName: guestRow.firstName,
      lastName: guestRow.lastName,
      phone: guestRow.phone,
      rut: guestRow.rut,
    }),
    items: Object.freeze(
      itemRows.map((item) =>
        Object.freeze({
          chargesClp: item.chargesClp,
          nightlyPriceClp: item.nightlyPriceClp,
          nights: item.nights,
          roomId: item.roomId,
          roomName: item.roomName ?? "",
          subtotalClp: item.subtotalClp,
        })
      )
    ),
    invoiceRequest: reservationRow.invoiceRequested
      ? Object.freeze({
          businessActivity: reservationRow.invoiceBusinessActivity!,
          email: reservationRow.invoiceEmail!,
          name: reservationRow.invoiceName!,
          phone: reservationRow.invoicePhone!,
          rut: reservationRow.invoiceRut!,
        })
      : undefined,
    payments: Object.freeze(
      paymentRows.map((payment) =>
        Object.freeze({
          amountClp: payment.amountClp,
          createdAt: payment.createdAt,
          id: payment.id,
          paymentMethod: payment.paymentMethod,
          provider: payment.provider,
          providerPaymentId: payment.providerPaymentId,
          receivedAt: payment.receivedAt,
          refundedAmountClp: payment.refundedAmountClp,
          status: payment.status,
        })
      )
    ),
    channelSyncTasks: Object.freeze(
      channelSyncRows.map((task) =>
        Object.freeze({
          channel: task.channel,
          completedAt: task.completedAt,
          status: task.status,
        })
      )
    ),
    auditEvents: Object.freeze(
      auditRows.map((event) =>
        Object.freeze({
          action: event.action,
          actorUserId: event.actorUserId,
          after: event.after,
          before: event.before,
          occurredAt: event.occurredAt,
        })
      )
    ),
  });
}

/** Also exported for the payment-events audit trail, kept separate from the reservation-scoped events above since payment events key off `payments.id`, not `reservations.id`. */
export async function getPaymentEventsForPayment(
  db: ProductionDatabase,
  paymentId: string
) {
  return db
    .select()
    .from(paymentEvents)
    .where(eq(paymentEvents.paymentId, paymentId))
    .orderBy(desc(paymentEvents.occurredAt));
}
