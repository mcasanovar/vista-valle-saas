import "server-only";

import { and, eq, gt, isNull, sql } from "drizzle-orm";

import {
  checkRoomAvailability,
  createLodgingInterval,
  RoomLockConflictError,
  type LodgingInterval,
  type OccupyingInterval,
  type RoomLockGateway,
} from "@/features/availability";
import {
  reservationHolds,
  reservationItems,
  reservations,
  roomBlocks,
  rooms,
} from "@/persistence/schema";
import type {
  ProductionDatabase,
  ProductionDatabaseTransaction,
} from "./client";

/**
 * The transaction handle handed to `RoomLockGateway.runExclusive` operations
 * by `createDrizzleRoomLockGateway`. Callers (tasks 4.5, 4.6, and the
 * assistant's block execution) run their `INSERT`s against this same `tx`
 * so they commit or roll back atomically with the room lock and the
 * overlap recheck.
 */
export type ProductionRoomLockTransaction = ProductionDatabaseTransaction;

/**
 * Thrown when `runExclusive` is asked to lock a `roomId` that does not
 * exist in `rooms`. This is distinct from `RoomLockConflictError`: it means
 * the caller passed an invalid room, not that the room is occupied.
 */
export class RoomLockRoomNotFoundError extends Error {
  readonly code = "ROOM_LOCK_ROOM_NOT_FOUND" as const;

  constructor(roomId: string) {
    super(`Room not found for locking: ${roomId}`);
    this.name = "RoomLockRoomNotFoundError";
  }
}

/**
 * Structural subset of `ProductionDatabase`/`ProductionRoomLockTransaction`
 * this query needs - just enough to run outside a lock too (the read-only
 * availability search in `src/infrastructure/database/availability-source.ts`
 * calls this with the plain `ProductionDatabase`, not a transaction).
 */
type QueryableDatabase = Pick<ProductionDatabase, "select">;

/**
 * Confirmed reservations, unexpired holds, and active blocks for `roomId`.
 * Shared by the transactional lock above (task 4.4) and the read-only
 * availability search repository (`./availability-source.ts`) so both stay
 * consistent with exactly one query definition.
 */
export async function listOccupyingIntervals(
  tx: QueryableDatabase,
  roomId: string,
  now: Date
): Promise<readonly OccupyingInterval[]> {
  const [reservationRows, holdRows, blockRows] = await Promise.all([
    tx
      .select({
        checkIn: reservations.checkIn,
        checkOut: reservations.checkOut,
        id: reservations.id,
      })
      .from(reservations)
      .innerJoin(
        reservationItems,
        eq(reservationItems.reservationId, reservations.id)
      )
      .where(
        and(
          eq(reservationItems.roomId, roomId),
          eq(reservations.status, "confirmed")
        )
      ),
    tx
      .select({
        checkIn: reservationHolds.checkIn,
        checkOut: reservationHolds.checkOut,
        id: reservationHolds.id,
      })
      .from(reservationHolds)
      .where(
        and(
          eq(reservationHolds.roomId, roomId),
          gt(reservationHolds.expiresAt, now)
        )
      ),
    tx
      .select({
        checkIn: roomBlocks.checkIn,
        checkOut: roomBlocks.checkOut,
        id: roomBlocks.id,
      })
      .from(roomBlocks)
      .where(and(eq(roomBlocks.roomId, roomId), isNull(roomBlocks.removedAt))),
  ]);

  return Object.freeze([
    ...reservationRows.map((row) =>
      Object.freeze({
        interval: createLodgingInterval(row.checkIn, row.checkOut),
        source: "reservation" as const,
        sourceId: row.id,
      })
    ),
    ...holdRows.map((row) =>
      Object.freeze({
        interval: createLodgingInterval(row.checkIn, row.checkOut),
        source: "hold" as const,
        sourceId: row.id,
      })
    ),
    ...blockRows.map((row) =>
      Object.freeze({
        interval: createLodgingInterval(row.checkIn, row.checkOut),
        source: "block" as const,
        sourceId: row.id,
      })
    ),
  ]);
}

/**
 * Drizzle/PostgreSQL-backed `RoomLockGateway` (design.md decision 6). Each
 * `runExclusive` call opens a transaction, runs `SELECT ... FOR UPDATE`
 * against the `rooms` row for `roomId` (locking it for the transaction's
 * duration), builds the occupying-interval view from that same transaction
 * (confirmed reservations, unexpired holds, active blocks — the same
 * predicate the mock repository applies, see
 * `src/features/availability/occupancy-source.ts`), and re-validates the
 * requested interval before ever calling `operation`.
 *
 * This module type-checks against the schema but is only exercised
 * against a live PostgreSQL server in an explicit `production`/integration
 * environment; it must never be imported by a code path that runs under
 * `VISTA_VALLE_CONFIG_CONTEXT=mock` (see `src/infrastructure/database/server.ts`
 * and design.md decision 13).
 */
export function createDrizzleRoomLockGateway(
  db: ProductionDatabase,
  now: () => Date = () => new Date()
): RoomLockGateway<ProductionRoomLockTransaction> {
  return Object.freeze({
    listOccupyingIntervals: (roomId) => listOccupyingIntervals(db, roomId, now()),
    runLockedMany: (roomIds, operation) =>
      db.transaction(async (tx) => {
        const ordered = [...new Set(roomIds)].sort();
        if (ordered.length !== roomIds.length || ordered.length === 0)
          throw new Error("Reservation requires distinct rooms");
        const locked = await tx
          .select({ id: rooms.id })
          .from(rooms)
          .where(sql`${rooms.id} IN ${ordered}`)
          .orderBy(rooms.id)
          .for("update");
        if (locked.length !== ordered.length)
          throw new RoomLockRoomNotFoundError(ordered[0]!);
        return operation(tx);
      }),
    runExclusiveMany: (roomIds, requestedInterval, operation) =>
      db.transaction(async (tx) => {
        const ordered = [...new Set(roomIds)].sort();
        if (ordered.length !== roomIds.length || ordered.length === 0)
          throw new Error("Reservation requires distinct rooms");
        const locked = await tx
          .select({ id: rooms.id })
          .from(rooms)
          .where(sql`${rooms.id} IN ${ordered}`)
          .orderBy(rooms.id)
          .for("update");
        if (locked.length !== ordered.length)
          throw new RoomLockRoomNotFoundError(ordered[0]!);
        for (const roomId of ordered) {
          const result = checkRoomAvailability(
            await listOccupyingIntervals(tx, roomId, now()),
            requestedInterval
          );
          if (!result.available)
            throw new RoomLockConflictError(result.conflicts, roomId);
        }
        return operation(tx);
      }),
    runLocked: <TResult>(
      roomId: string,
      operation: (context: ProductionRoomLockTransaction) => Promise<TResult>
    ) =>
      db.transaction(async (tx) => {
        const lockedRoom = await tx
          .select({ id: rooms.id })
          .from(rooms)
          .where(eq(rooms.id, roomId))
          .for("update");
        if (lockedRoom.length === 0)
          throw new RoomLockRoomNotFoundError(roomId);
        return operation(tx);
      }),
    runExclusive: <TResult>(
      roomId: string,
      requestedInterval: LodgingInterval,
      operation: (context: ProductionRoomLockTransaction) => Promise<TResult>
    ) =>
      db.transaction(async (tx) => {
        const lockedRoom = await tx
          .select({ id: rooms.id })
          .from(rooms)
          .where(eq(rooms.id, roomId))
          .for("update");

        if (lockedRoom.length === 0) {
          throw new RoomLockRoomNotFoundError(roomId);
        }

        const occupying = await listOccupyingIntervals(tx, roomId, now());
        const result = checkRoomAvailability(occupying, requestedInterval);

        if (!result.available) {
          throw new RoomLockConflictError(result.conflicts, roomId);
        }

        return operation(tx);
      }),
  });
}
