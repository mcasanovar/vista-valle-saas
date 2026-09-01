import "server-only";

import { and, eq, gt, isNull, lt, ne, type SQL } from "drizzle-orm";
import type { PgColumn } from "drizzle-orm/pg-core";

import { createLodgingInterval } from "@/features/availability";
import type {
  ReservationOrigin,
  ReservationStatus,
} from "@/features/reservations";
import {
  guests,
  reservationHolds,
  reservationItems,
  reservations,
  roomBlocks,
  rooms,
} from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

export type AdminCalendarItemKind = "reservation" | "hold" | "block";

export type AdminCalendarItem = Readonly<{
  /** Unique per bar - a multi-room reservation produces one item per room, so this is not the raw record id. */
  id: string;
  /** The underlying reservation/hold/block id, for linking to its detail page. */
  sourceId: string;
  roomId: string;
  room: string;
  checkIn: string;
  checkOut: string;
  kind: AdminCalendarItemKind;
  origin?: ReservationOrigin;
  status?: ReservationStatus;
  guestName?: string;
  reason?: string;
}>;

export type AdminCalendarFilter = Readonly<{
  checkIn: string;
  checkOut: string;
  roomId?: string;
  origin?: ReservationOrigin;
}>;

export type AdminCalendar = Readonly<{
  window: Readonly<{ checkIn: string; checkOut: string }>;
  items: readonly AdminCalendarItem[];
}>;

/**
 * `checkIn < window.checkOut AND checkOut > window.checkIn` - the same
 * half-open overlap predicate used by `listOccupyingIntervals`
 * (`./room-lock.ts`) and the original mock calendar, so an item touching
 * the visible range at either edge is included exactly once.
 */
function overlapsWindow(
  checkInColumn: PgColumn,
  checkOutColumn: PgColumn,
  window: Readonly<{ checkIn: string; checkOut: string }>
): SQL {
  return and(
    lt(checkInColumn, window.checkOut),
    gt(checkOutColumn, window.checkIn)
  ) as SQL;
}

/**
 * Real occupancy for the admin calendar (task 1.1): confirmed/pending
 * reservations (excludes `cancelled`), unexpired holds, and active
 * (non-removed) blocks overlapping `filter.checkIn`/`filter.checkOut`,
 * normalized to one item shape regardless of source table. `roomId` and
 * `origin` filters apply to reservations/holds; `origin` never excludes
 * blocks, which have no origin (see spec scenario "Filtrar por origen").
 */
export async function queryAdminCalendar(
  db: ProductionDatabase,
  filter: AdminCalendarFilter
): Promise<AdminCalendar> {
  const window = createLodgingInterval(filter.checkIn, filter.checkOut);

  const reservationConditions = [
    ne(reservations.status, "cancelled"),
    overlapsWindow(reservations.checkIn, reservations.checkOut, window),
  ];
  if (filter.roomId)
    reservationConditions.push(eq(reservationItems.roomId, filter.roomId));
  if (filter.origin)
    reservationConditions.push(eq(reservations.origin, filter.origin));

  const holdConditions = [
    gt(reservationHolds.expiresAt, new Date()),
    overlapsWindow(reservationHolds.checkIn, reservationHolds.checkOut, window),
  ];
  if (filter.roomId)
    holdConditions.push(eq(reservationHolds.roomId, filter.roomId));

  const blockConditions = [
    isNull(roomBlocks.removedAt),
    overlapsWindow(roomBlocks.checkIn, roomBlocks.checkOut, window),
  ];
  if (filter.roomId) blockConditions.push(eq(roomBlocks.roomId, filter.roomId));

  const [reservationRows, holdRows, blockRows] = await Promise.all([
    db
      .select({
        checkIn: reservations.checkIn,
        checkOut: reservations.checkOut,
        firstName: guests.firstName,
        id: reservations.id,
        lastName: guests.lastName,
        origin: reservations.origin,
        roomId: reservationItems.roomId,
        roomName: rooms.name,
        status: reservations.status,
      })
      .from(reservations)
      .innerJoin(guests, eq(reservations.guestId, guests.id))
      .innerJoin(
        reservationItems,
        eq(reservationItems.reservationId, reservations.id)
      )
      .innerJoin(rooms, eq(reservationItems.roomId, rooms.id))
      .where(and(...reservationConditions)),
    db
      .select({
        checkIn: reservationHolds.checkIn,
        checkOut: reservationHolds.checkOut,
        firstName: guests.firstName,
        id: reservationHolds.id,
        lastName: guests.lastName,
        roomId: reservationHolds.roomId,
        roomName: rooms.name,
      })
      .from(reservationHolds)
      .innerJoin(guests, eq(reservationHolds.guestId, guests.id))
      .innerJoin(rooms, eq(reservationHolds.roomId, rooms.id))
      .where(and(...holdConditions)),
    db
      .select({
        checkIn: roomBlocks.checkIn,
        checkOut: roomBlocks.checkOut,
        id: roomBlocks.id,
        reason: roomBlocks.reason,
        roomId: roomBlocks.roomId,
        roomName: rooms.name,
      })
      .from(roomBlocks)
      .innerJoin(rooms, eq(roomBlocks.roomId, rooms.id))
      .where(and(...blockConditions)),
  ]);

  const items: AdminCalendarItem[] = [
    ...reservationRows.map(
      (row): AdminCalendarItem => ({
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        guestName: `${row.firstName} ${row.lastName}`,
        id: `reservation-${row.id}-${row.roomId}`,
        kind: "reservation",
        origin: row.origin as ReservationOrigin,
        room: row.roomName ?? "",
        roomId: row.roomId,
        sourceId: row.id,
        status: row.status as ReservationStatus,
      })
    ),
    ...holdRows.map(
      (row): AdminCalendarItem => ({
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        guestName: `${row.firstName} ${row.lastName}`,
        id: `hold-${row.id}`,
        kind: "hold",
        room: row.roomName ?? "",
        roomId: row.roomId,
        sourceId: row.id,
      })
    ),
    ...blockRows.map(
      (row): AdminCalendarItem => ({
        checkIn: row.checkIn,
        checkOut: row.checkOut,
        id: `block-${row.id}`,
        kind: "block",
        reason: row.reason,
        room: row.roomName ?? "",
        roomId: row.roomId,
        sourceId: row.id,
      })
    ),
  ];

  return Object.freeze({
    items: Object.freeze(items),
    window,
  });
}
