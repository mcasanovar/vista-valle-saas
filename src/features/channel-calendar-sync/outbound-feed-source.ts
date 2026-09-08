import "server-only";
import {
  mockReservationRepository,
  mockRoomLockGateway,
} from "@/features/reservations";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { listOccupyingIntervals } from "@/infrastructure/database/room-lock";
import { reservations } from "@/persistence/schema";
import { inArray } from "drizzle-orm";
import type { ChannelFeedOccupancyEntry } from "./outbound-feed";

/**
 * Assembles the occupancy entries for one room's outbound feed under the
 * `mock` config context, resolving each reservation-sourced occupying
 * interval's `origin` so `generateOutboundIcalDocument` can exclude a
 * platform's own reservations. Holds and blocks pass through with no
 * `origin` (see `outbound-feed.ts`). A Drizzle-backed equivalent for the
 * `production` context is a separate task, not yet built.
 */
export async function getMockOutboundFeedEntries(
  roomId: string
): Promise<readonly ChannelFeedOccupancyEntry[] | null> {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "mock") return null;
  const occupying =
    (await mockRoomLockGateway.listOccupyingIntervals?.(roomId)) ?? [];
  return Promise.all(
    occupying.map(async (entry): Promise<ChannelFeedOccupancyEntry> => {
      if (entry.source !== "reservation") {
        return {
          interval: entry.interval,
          source: entry.source,
          sourceId: entry.sourceId,
        };
      }
      const reservation = await mockReservationRepository.getReservationById(
        entry.sourceId
      );
      return {
        interval: entry.interval,
        source: entry.source,
        sourceId: entry.sourceId,
        origin: reservation?.origin,
      };
    })
  );
}

export async function getProductionOutboundFeedEntries(
  roomId: string
): Promise<readonly ChannelFeedOccupancyEntry[]> {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") return [];
  const db = createProductionDatabase(boundary);
  const occupying = await listOccupyingIntervals(db, roomId, new Date());
  const reservationIds = occupying
    .filter((entry) => entry.source === "reservation")
    .map((entry) => entry.sourceId);
  const reservationRows = reservationIds.length
    ? await db
        .select({ id: reservations.id, origin: reservations.origin })
        .from(reservations)
        .where(inArray(reservations.id, reservationIds))
    : [];
  const origins = new Map(reservationRows.map((row) => [row.id, row.origin]));
  return Object.freeze(
    occupying.map((entry) => ({
      interval: entry.interval,
      source: entry.source,
      sourceId: entry.sourceId,
      origin:
        entry.source === "reservation"
          ? origins.get(entry.sourceId)
          : undefined,
    }))
  );
}
