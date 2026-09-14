import "server-only";

import { and, eq } from "drizzle-orm";
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
 * Writes both occupancy tiers atomically (design.md decision 1: a
 * capacity-1 room only ever gets its occupancy-1 row) and records one
 * audit event per update - see `admin-room-pricing` spec.
 */
export function createDrizzleRoomPricingRepository(
  db: ProductionDatabase
): RoomPricingRepository {
  return Object.freeze({
    update: async (room, input, actorUserId) => {
      await db.transaction(async (tx) => {
        await upsertOccupancyPrice(tx, room.id, 1, input.priceOneGuestClp);
        if (room.capacity > 1) {
          await upsertOccupancyPrice(tx, room.id, 2, input.priceTwoGuestsClp);
        } else {
          await tx
            .delete(roomOccupancyPrices)
            .where(
              and(
                eq(roomOccupancyPrices.roomId, room.id),
                eq(roomOccupancyPrices.occupancy, 2)
              )
            );
        }
        await tx.insert(auditEvents).values({
          action: "room_pricing.updated",
          actorUserId,
          after: {
            priceOneGuestClp: input.priceOneGuestClp,
            priceTwoGuestsClp:
              room.capacity > 1 ? input.priceTwoGuestsClp : null,
          },
          entityId: room.id,
          entityType: "room",
        });
      });
    },
  });
}
