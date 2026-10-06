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
  ne,
  notExists,
  or,
  sql,
} from "drizzle-orm";

import { requireAdministrator } from "@/infrastructure/auth/authorization";
import {
  companyQuotationLines,
  companyQuotations,
  notificationOutbox,
} from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

/**
 * Delivery state as the administrator sees it, derived from the quotation's
 * notification intents (see design.md decision 4). `companyQuotations.status`
 * is never updated by any code path, so it is deliberately not used here.
 */
export type AdminCompanyQuotationDeliveryState =
  | "delivered"
  | "failed"
  | "pending";

export type AdminCompanyQuotationDateRangeFilter = Readonly<{
  /** Inclusive lower bound (a single-date filter sets `from === to`). */
  from?: string;
  /** Inclusive upper bound. */
  to?: string;
}>;

export type AdminCompanyQuotationListFilter = Readonly<{
  /** Free-text search across company, contact, email, and phone. Never matches the free-form `message`. */
  search?: string;
  checkIn?: AdminCompanyQuotationDateRangeFilter;
  checkOut?: AdminCompanyQuotationDateRangeFilter;
  deliveryState?: AdminCompanyQuotationDeliveryState;
  /** 1-based. */
  page: number;
  /** Defaults to 20. */
  pageSize?: number;
}>;

export type AdminCompanyQuotationListRow = Readonly<{
  id: string;
  company: string;
  contact: string;
  email: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestCount: number;
  rooms: readonly string[];
  totalClp: number;
  breakfastRequested: boolean;
  deliveryState: AdminCompanyQuotationDeliveryState;
  createdAt: Date;
}>;

export type AdminCompanyQuotationListResult = Readonly<{
  rows: readonly AdminCompanyQuotationListRow[];
  total: number;
  page: number;
  pageSize: number;
}>;

const DEFAULT_PAGE_SIZE = 20;

function intentsFor(db: ProductionDatabase, condition?: ReturnType<typeof and>) {
  return db
    .select({ one: sql`1` })
    .from(notificationOutbox)
    .where(
      and(eq(notificationOutbox.quotationId, companyQuotations.id), condition)
    );
}

function buildListConditions(
  db: ProductionDatabase,
  filter: AdminCompanyQuotationListFilter
) {
  const conditions = [];
  if (filter.checkIn?.from)
    conditions.push(gte(companyQuotations.checkIn, filter.checkIn.from));
  if (filter.checkIn?.to)
    conditions.push(lte(companyQuotations.checkIn, filter.checkIn.to));
  if (filter.checkOut?.from)
    conditions.push(gte(companyQuotations.checkOut, filter.checkOut.from));
  if (filter.checkOut?.to)
    conditions.push(lte(companyQuotations.checkOut, filter.checkOut.to));

  const term = filter.search?.trim();
  if (term) {
    const pattern = `%${term}%`;
    conditions.push(
      or(
        ilike(companyQuotations.company, pattern),
        ilike(companyQuotations.contact, pattern),
        ilike(companyQuotations.email, pattern),
        ilike(companyQuotations.phone, pattern)
      )
    );
  }

  const failedIntents = () =>
    intentsFor(db, and(eq(notificationOutbox.status, "failed")));
  const undeliveredIntents = () =>
    intentsFor(db, and(ne(notificationOutbox.status, "delivered")));
  if (filter.deliveryState === "delivered") {
    conditions.push(
      and(exists(intentsFor(db)), notExists(undeliveredIntents()))
    );
  } else if (filter.deliveryState === "failed") {
    conditions.push(exists(failedIntents()));
  } else if (filter.deliveryState === "pending") {
    // A quotation with no intents at all is pending too, hence the `or`.
    conditions.push(
      and(
        notExists(failedIntents()),
        or(notExists(intentsFor(db)), exists(undeliveredIntents()))
      )
    );
  }

  return conditions.length ? and(...conditions) : undefined;
}

function deliveryStateOf(
  statuses: readonly string[]
): AdminCompanyQuotationDeliveryState {
  if (statuses.length === 0) return "pending";
  if (statuses.includes("failed")) return "failed";
  return statuses.every((status) => status === "delivered")
    ? "delivered"
    : "pending";
}

/**
 * Two-phase paginated listing, mirroring `listAdminReservations`: phase 1
 * selects only quotation ids under the active filters, so `LIMIT`/`OFFSET`
 * and the total count are never inflated by a quotation holding several room
 * lines; phase 2 loads the light per-line and delivery detail for just that
 * page's ids.
 */
export async function listAdminCompanyQuotations(
  db: ProductionDatabase,
  filter: AdminCompanyQuotationListFilter
): Promise<AdminCompanyQuotationListResult> {
  await requireAdministrator();
  const pageSize = filter.pageSize ?? DEFAULT_PAGE_SIZE;
  const page = Math.max(1, filter.page);
  const offset = (page - 1) * pageSize;
  const where = buildListConditions(db, filter);

  const idRows = await db
    .select({ id: companyQuotations.id })
    .from(companyQuotations)
    .where(where)
    .orderBy(desc(companyQuotations.createdAt))
    .limit(pageSize)
    .offset(offset);

  const [countRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(companyQuotations)
    .where(where);
  const total = countRow?.count ?? 0;

  const ids = idRows.map((row) => row.id);
  if (ids.length === 0) {
    return Object.freeze({ rows: [], total, page, pageSize });
  }

  const [quotationRows, lineRows, intentRows] = await Promise.all([
    db
      .select({
        breakfastRequested: companyQuotations.breakfastRequested,
        checkIn: companyQuotations.checkIn,
        checkOut: companyQuotations.checkOut,
        company: companyQuotations.company,
        contact: companyQuotations.contact,
        createdAt: companyQuotations.createdAt,
        email: companyQuotations.email,
        guestCount: companyQuotations.guestCount,
        id: companyQuotations.id,
        nights: companyQuotations.nights,
        totalClp: companyQuotations.totalClp,
      })
      .from(companyQuotations)
      .where(inArray(companyQuotations.id, ids)),
    db
      .select({
        quantity: companyQuotationLines.quantity,
        quotationId: companyQuotationLines.quotationId,
        roomName: companyQuotationLines.roomNameSnapshot,
      })
      .from(companyQuotationLines)
      .where(inArray(companyQuotationLines.quotationId, ids)),
    db
      .select({
        quotationId: notificationOutbox.quotationId,
        status: notificationOutbox.status,
      })
      .from(notificationOutbox)
      .where(inArray(notificationOutbox.quotationId, ids)),
  ]);

  const roomsById = new Map<string, string[]>();
  for (const line of lineRows) {
    const names = roomsById.get(line.quotationId) ?? [];
    names.push(
      line.quantity > 1 ? `${line.quantity} × ${line.roomName}` : line.roomName
    );
    roomsById.set(line.quotationId, names);
  }

  const statusesById = new Map<string, string[]>();
  for (const intent of intentRows) {
    if (!intent.quotationId) continue;
    const statuses = statusesById.get(intent.quotationId) ?? [];
    statuses.push(intent.status);
    statusesById.set(intent.quotationId, statuses);
  }

  const byId = new Map(
    quotationRows.map((row) => [
      row.id,
      Object.freeze({
        breakfastRequested: row.breakfastRequested,
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        company: row.company,
        contact: row.contact,
        createdAt: row.createdAt,
        deliveryState: deliveryStateOf(statusesById.get(row.id) ?? []),
        email: row.email,
        guestCount: row.guestCount,
        id: row.id,
        nights: row.nights,
        rooms: Object.freeze(roomsById.get(row.id) ?? []),
        totalClp: row.totalClp,
      }),
    ])
  );

  const rows = ids
    .map((id) => byId.get(id))
    .filter((row): row is AdminCompanyQuotationListRow => Boolean(row));

  return Object.freeze({ rows: Object.freeze(rows), total, page, pageSize });
}

export type AdminCompanyQuotationDetailLine = Readonly<{
  roomSlug: string;
  roomName: string;
  capacity: number;
  guestCount: number;
  nightlyPriceClp: number;
  nights: number;
  quantity: number;
  subtotalClp: number;
}>;

/** Delivery state of one notification intent. Deliberately omits the recipient and any provider reference, like `notification-delivery-status.ts`. */
export type AdminCompanyQuotationDetailNotification = Readonly<{
  type: string;
  status: "delivered" | "failed" | "pending" | "processing" | "retrying";
  attempts: number;
  lastErrorCode: string | null;
  deliveredAt: Date | null;
  createdAt: Date;
}>;

export type AdminCompanyQuotationDetail = Readonly<{
  id: string;
  company: string;
  contact: string;
  email: string;
  phone: string;
  requireParking: boolean;
  message: string | null;
  checkIn: string;
  checkOut: string;
  nights: number;
  guestCount: number;
  capacity: number;
  breakfastRequested: boolean;
  breakfastQuantity: number | null;
  breakfastUnitPriceClp: number | null;
  breakfastSubtotalClp: number;
  totalClp: number;
  createdAt: Date;
  lines: readonly AdminCompanyQuotationDetailLine[];
  notifications: readonly AdminCompanyQuotationDetailNotification[];
  deliveryState: AdminCompanyQuotationDeliveryState;
}>;

export async function getAdminCompanyQuotationDetail(
  db: ProductionDatabase,
  id: string
): Promise<AdminCompanyQuotationDetail | null> {
  await requireAdministrator();
  const [quotationRow] = await db
    .select()
    .from(companyQuotations)
    .where(eq(companyQuotations.id, id))
    .limit(1);
  if (!quotationRow) return null;

  const [lineRows, intentRows] = await Promise.all([
    db
      .select()
      .from(companyQuotationLines)
      .where(eq(companyQuotationLines.quotationId, id)),
    db
      .select({
        attempts: notificationOutbox.attempts,
        createdAt: notificationOutbox.createdAt,
        deliveredAt: notificationOutbox.deliveredAt,
        lastError: notificationOutbox.lastError,
        status: notificationOutbox.status,
        type: notificationOutbox.type,
      })
      .from(notificationOutbox)
      .where(eq(notificationOutbox.quotationId, id))
      .orderBy(notificationOutbox.createdAt),
  ]);

  return Object.freeze({
    breakfastQuantity: quotationRow.breakfastQuantity,
    breakfastRequested: quotationRow.breakfastRequested,
    breakfastSubtotalClp: quotationRow.breakfastSubtotalClp,
    breakfastUnitPriceClp: quotationRow.breakfastUnitPriceClpSnapshot,
    capacity: quotationRow.capacity,
    checkIn: quotationRow.checkIn,
    checkOut: quotationRow.checkOut,
    company: quotationRow.company,
    contact: quotationRow.contact,
    createdAt: quotationRow.createdAt,
    deliveryState: deliveryStateOf(intentRows.map((intent) => intent.status)),
    email: quotationRow.email,
    guestCount: quotationRow.guestCount,
    id: quotationRow.id,
    lines: Object.freeze(
      lineRows.map((line) =>
        Object.freeze({
          capacity: line.capacitySnapshot,
          guestCount: line.guestCount,
          nightlyPriceClp: line.nightlyPriceClpSnapshot,
          nights: line.nights,
          quantity: line.quantity,
          roomName: line.roomNameSnapshot,
          roomSlug: line.roomSlug,
          subtotalClp: line.subtotalClp,
        })
      )
    ),
    message: quotationRow.message,
    nights: quotationRow.nights,
    notifications: Object.freeze(
      intentRows.map((intent) =>
        Object.freeze({
          attempts: intent.attempts,
          createdAt: intent.createdAt,
          deliveredAt: intent.deliveredAt,
          lastErrorCode: intent.lastError,
          status: intent.status,
          type: intent.type,
        })
      )
    ),
    phone: quotationRow.phone,
    requireParking: quotationRow.requireParking,
    totalClp: quotationRow.totalClp,
  });
}
