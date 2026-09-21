import "server-only";

import { and, eq, gt } from "drizzle-orm";
import type { RoomPricingRepository } from "@/features/rooms";
import { auditEvents, roomOccupancyPrices } from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

async function upsertOccupancyPrice(
  db: ProductionDatabase,
  roomId: string,
  occupancy: number,
  priceClp: number
) {
  await db
    .insert(roomOccupancyPrices)
    .values({ occupancy, priceClp, roomId })
    .onConflictDoUpdate({
      set: { priceClp, updatedAt: new Date() },
      target: [roomOccupancyPrices.roomId, roomOccupancyPrices.occupancy],
    });
}

/**
 * Writes one row per occupancy tier (1 guest through the room's capacity)
 * atomically, dropping any stale tier left over from a larger capacity the
 * room used to have, and records one audit event per update - see
 * `admin-room-pricing` spec.
 */
export function createDrizzleRoomPricingRepository(
  db: ProductionDatabase
): RoomPricingRepository {
  return Object.freeze({
    update: async (room, input, actorUserId) => {
      await db.transaction(async (tx) => {
        for (const [index, priceClp] of input.prices.entries()) {
          await upsertOccupancyPrice(tx, room.id, index + 1, priceClp);
        }
        await tx
          .delete(roomOccupancyPrices)
          .where(
            and(
              eq(roomOccupancyPrices.roomId, room.id),
              gt(roomOccupancyPrices.occupancy, input.prices.length)
            )
          );
        await tx.insert(auditEvents).values({
          action: "room_pricing.updated",
          actorUserId,
          after: { prices: input.prices },
          entityId: room.id,
          entityType: "room",
        });
      });
    },
  });
}
