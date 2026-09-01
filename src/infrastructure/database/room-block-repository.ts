import "server-only";
import { and, desc, eq, ilike, isNotNull, isNull, sql } from "drizzle-orm";
import type {
  ManualRoomBlockAuditEvent,
  NormalizedRoomBlockListFilter,
  RoomBlock,
  RoomBlockDetail,
  RoomBlockPage,
} from "@/features/room-blocks";
import { nights } from "@/features/availability";
import { auditEvents, roomBlocks } from "@/persistence/schema";
import type { ProductionDatabase } from "./client";
import type { ProductionRoomLockTransaction } from "./room-lock";
const record = (r: typeof roomBlocks.$inferSelect): RoomBlock =>
  Object.freeze({
    id: r.id,
    roomId: r.roomId,
    checkIn: r.checkIn,
    checkOut: r.checkOut,
    reason: r.reason,
    createdBy: r.createdByUserId,
    createdAt: r.createdAt,
    removedAt: r.removedAt ?? undefined,
    removedBy: r.removedByUserId ?? undefined,
  });
export function createDrizzleRoomBlockRepository(db: ProductionDatabase) {
  return Object.freeze({
    createMany: async (
      tx: ProductionRoomLockTransaction,
      input: Readonly<{
        roomIds: readonly string[];
        reason: string;
        interval: Readonly<{ checkIn: string; checkOut: string }>;
      }>,
      actor: string,
      options: Readonly<{ confirmedWithConflicts?: boolean }> = {}
    ): Promise<readonly RoomBlock[]> => {
      const rows = await tx
        .insert(roomBlocks)
        .values(
          input.roomIds.map((roomId) => ({
            roomId,
            checkIn: input.interval.checkIn,
            checkOut: input.interval.checkOut,
            reason: input.reason,
            createdByUserId: actor,
          }))
        )
        .returning();
      for (const row of rows)
        await tx.insert(auditEvents).values({
          action: "room_block.created",
          actorUserId: actor,
          entityType: "room_block",
          entityId: row.id,
          after: {
            roomId: row.roomId,
            checkIn: row.checkIn,
            checkOut: row.checkOut,
            reason: row.reason,
            ...(options.confirmedWithConflicts
              ? { confirmedWithConflicts: true }
              : {}),
          },
        });
      return Object.freeze(rows.map(record));
    },
    list: async (
      filter: NormalizedRoomBlockListFilter
    ): Promise<RoomBlockPage> => {
      const conditions = [];
      if (filter.roomId) conditions.push(eq(roomBlocks.roomId, filter.roomId));
      if (filter.status === "active")
        conditions.push(isNull(roomBlocks.removedAt));
      if (filter.status === "removed")
        conditions.push(isNotNull(roomBlocks.removedAt));
      if (filter.reason)
        conditions.push(ilike(roomBlocks.reason, `%${filter.reason}%`));
      if (filter.interval)
        conditions.push(
          sql`${roomBlocks.checkIn} < ${filter.interval.checkOut} and ${roomBlocks.checkOut} > ${filter.interval.checkIn}`
        );
      const where = conditions.length ? and(...conditions) : undefined;
      const rows = await db
        .select()
        .from(roomBlocks)
        .where(where)
        .orderBy(desc(roomBlocks.createdAt), desc(roomBlocks.id))
        .limit(filter.pageSize)
        .offset((filter.page - 1) * filter.pageSize);
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(roomBlocks)
        .where(where);
      return Object.freeze({
        items: Object.freeze(
          rows.map((r) =>
            Object.freeze({
              ...record(r),
              nights: nights(r.checkIn, r.checkOut),
            })
          )
        ),
        page: filter.page,
        pageSize: filter.pageSize,
        total: Number(count),
      });
    },
    detail: async (id: string): Promise<RoomBlockDetail | null> => {
      const [row] = await db
        .select()
        .from(roomBlocks)
        .where(eq(roomBlocks.id, id));
      if (!row) return null;
      const events = await db
        .select()
        .from(auditEvents)
        .where(
          and(
            eq(auditEvents.entityType, "room_block"),
            eq(auditEvents.entityId, id)
          )
        )
        .orderBy(auditEvents.occurredAt);
      return Object.freeze({
        ...record(row),
        nights: nights(row.checkIn, row.checkOut),
        audit: Object.freeze(
          events.map(
            (event) =>
              Object.freeze({
                action: event.action.endsWith("removed")
                  ? "removed"
                  : "created",
                actor: event.actorUserId ?? "",
                at: event.occurredAt,
                blockId: id,
              }) satisfies ManualRoomBlockAuditEvent
          )
        ),
      });
    },
    remove: async (id: string, actor: string): Promise<RoomBlock> =>
      db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(roomBlocks)
          .where(and(eq(roomBlocks.id, id), isNull(roomBlocks.removedAt)));
        if (!current) throw new Error("Block not found");
        const [row] = await tx
          .update(roomBlocks)
          .set({ removedAt: new Date(), removedByUserId: actor })
          .where(eq(roomBlocks.id, id))
          .returning();
        if (!row) throw new Error("Failed to remove room block");
        await tx.insert(auditEvents).values({
          action: "room_block.removed",
          actorUserId: actor,
          entityType: "room_block",
          entityId: id,
          before: {
            roomId: current.roomId,
            checkIn: current.checkIn,
            checkOut: current.checkOut,
            reason: current.reason,
          },
        });
        return record(row);
      }),
  });
}
