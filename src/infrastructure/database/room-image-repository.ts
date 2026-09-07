import "server-only";
import { and, asc, eq } from "drizzle-orm";
import type { RoomImageRecord } from "@/features/room-images";
import { auditEvents, roomImages } from "@/persistence/schema";
import type { ProductionDatabase, ProductionDatabaseTransaction } from "./client";

const record = (r: typeof roomImages.$inferSelect): RoomImageRecord =>
  Object.freeze({
    altText: r.altText ?? "",
    createdAt: r.createdAt,
    id: r.id,
    position: r.position,
    roomId: r.roomId,
    storagePath: r.storagePath,
  });

export function createDrizzleRoomImageRepository(db: ProductionDatabase) {
  return Object.freeze({
    listByRoom: async (roomId: string): Promise<readonly RoomImageRecord[]> =>
      db
        .select()
        .from(roomImages)
        .where(eq(roomImages.roomId, roomId))
        .orderBy(asc(roomImages.position))
        .then((rows) => Object.freeze(rows.map(record))),

    /** Appends every upload after the current highest position, inserts one audit event per photo, and returns the inserted rows in upload order - all inside the caller's transaction. */
    appendMany: async (
      tx: ProductionDatabaseTransaction,
      roomId: string,
      uploads: readonly Readonly<{ altText: string; storagePath: string }>[],
      actor: string
    ): Promise<readonly RoomImageRecord[]> => {
      const existing = await tx
        .select({ position: roomImages.position })
        .from(roomImages)
        .where(eq(roomImages.roomId, roomId))
        .orderBy(asc(roomImages.position));
      const nextPosition = existing.length
        ? Math.max(...existing.map((row) => row.position)) + 1
        : 0;

      const rows = await tx
        .insert(roomImages)
        .values(
          uploads.map((upload, index) => ({
            altText: upload.altText || null,
            position: nextPosition + index,
            roomId,
            storagePath: upload.storagePath,
          }))
        )
        .returning();

      for (const row of rows)
        await tx.insert(auditEvents).values({
          action: "room_image.uploaded",
          actorUserId: actor,
          after: { position: row.position, storagePath: row.storagePath },
          entityId: row.id,
          entityType: "room_image",
        });

      return Object.freeze(rows.map(record));
    },

    /** Rewrites every position for the room to match `orderedImageIds` (index = new position), covering reordering, promoting a new principal, and closing gaps after a removal - always inside the caller's transaction. */
    persistOrder: async (
      tx: ProductionDatabaseTransaction,
      roomId: string,
      orderedImageIds: readonly string[],
      actor: string,
      auditAction: string
    ): Promise<void> => {
      // `position` is CHECK'd >= 0, so the intermediate pass cannot use negative
      // placeholders; it parks every row in a high band no real room ever
      // reaches instead, then the second pass assigns the real 0-based order.
      const parkingBand = 1_000_000;
      for (const [index, imageId] of orderedImageIds.entries()) {
        await tx
          .update(roomImages)
          .set({ position: parkingBand + index })
          .where(and(eq(roomImages.id, imageId), eq(roomImages.roomId, roomId)));
      }
      for (const [index, imageId] of orderedImageIds.entries()) {
        await tx
          .update(roomImages)
          .set({ position: index })
          .where(and(eq(roomImages.id, imageId), eq(roomImages.roomId, roomId)));
      }
      await tx.insert(auditEvents).values({
        action: auditAction,
        actorUserId: actor,
        after: { order: orderedImageIds },
        entityId: roomId,
        entityType: "room",
      });
    },

    remove: async (
      tx: ProductionDatabaseTransaction,
      roomId: string,
      imageId: string,
      actor: string
    ): Promise<RoomImageRecord> => {
      const [current] = await tx
        .select()
        .from(roomImages)
        .where(and(eq(roomImages.id, imageId), eq(roomImages.roomId, roomId)));
      if (!current) throw new Error("Room image not found");

      await tx.delete(roomImages).where(eq(roomImages.id, imageId));
      await tx.insert(auditEvents).values({
        action: "room_image.removed",
        actorUserId: actor,
        before: { position: current.position, storagePath: current.storagePath },
        entityId: imageId,
        entityType: "room_image",
      });

      return record(current);
    },
  });
}
