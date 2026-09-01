import "server-only";
import { getServerEnvironment } from "@/config/server";
import { mockReservationRepository, mockRoomLockGateway } from "@/features/reservations";
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
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return null;
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
