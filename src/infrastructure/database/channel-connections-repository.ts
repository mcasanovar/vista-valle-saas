import "server-only";

import { and, eq } from "drizzle-orm";
import { channelConnections } from "@/persistence/schema";
import type {
  ChannelConnection,
  AsyncChannelConnectionStore,
  ChannelPlatform,
  RecordPollResultInput,
  SetInboundFeedUrlInput,
} from "@/features/channel-calendar-sync";
import type { ProductionDatabase } from "./client";

function toConnection(
  row: typeof channelConnections.$inferSelect
): ChannelConnection {
  return Object.freeze({
    id: row.id,
    roomId: row.roomId,
    platform: row.platform as ChannelPlatform,
    paymentBehavior: row.paymentBehavior,
    hasInboundFeedUrl: Boolean(row.inboundFeedUrl),
    outboundToken: row.outboundToken,
    enabled: row.enabled,
    lastPolledAt: row.lastPolledAt ?? undefined,
    lastPollStatus: row.lastPollStatus ?? undefined,
    lastPollEventCount: row.lastPollEventCount ?? undefined,
    lastPollError: row.lastPollError ?? undefined,
  });
}

export type ProductionChannelConnectionStore = AsyncChannelConnectionStore;

export function createDrizzleChannelConnectionRepository(
  db: ProductionDatabase
): ProductionChannelConnectionStore {
  async function findById(id: string) {
    const [row] = await db
      .select()
      .from(channelConnections)
      .where(eq(channelConnections.id, id));
    if (!row) throw new Error("Channel connection not found");
    return row;
  }

  return Object.freeze({
    list: async () =>
      Object.freeze(
        (await db.select().from(channelConnections)).map(toConnection)
      ),
    listActive: async () =>
      Object.freeze(
        (
          await db
            .select()
            .from(channelConnections)
            .where(eq(channelConnections.enabled, true))
        ).map(toConnection)
      ),
    getByRoomAndPlatform: async (roomId: string, platform: ChannelPlatform) => {
      const [row] = await db
        .select()
        .from(channelConnections)
        .where(
          and(
            eq(channelConnections.roomId, roomId),
            eq(channelConnections.platform, platform)
          )
        );
      return row ? toConnection(row) : null;
    },
    getByOutboundToken: async (token: string) => {
      const [row] = await db
        .select()
        .from(channelConnections)
        .where(eq(channelConnections.outboundToken, token));
      return row ? toConnection(row) : null;
    },
    setInboundFeedUrl: async (input: SetInboundFeedUrlInput) => {
      const [row] = await db
        .insert(channelConnections)
        .values({
          roomId: input.roomId,
          platform: input.platform,
          paymentBehavior: input.paymentBehavior,
          inboundFeedUrl: input.inboundFeedUrl,
          outboundToken: crypto.randomUUID().replaceAll("-", ""),
          enabled: true,
        })
        .onConflictDoUpdate({
          target: [channelConnections.roomId, channelConnections.platform],
          set: {
            inboundFeedUrl: input.inboundFeedUrl,
            paymentBehavior: input.paymentBehavior,
            enabled: true,
            updatedAt: new Date(),
          },
        })
        .returning();
      if (!row) throw new Error("Failed to save channel connection");
      return toConnection(row);
    },
    setEnabled: async (id: string, enabled: boolean) => {
      const [row] = await db
        .update(channelConnections)
        .set({ enabled, updatedAt: new Date() })
        .where(eq(channelConnections.id, id))
        .returning();
      if (!row) throw new Error("Channel connection not found");
      return toConnection(row);
    },
    regenerateOutboundToken: async (id: string) => {
      const [row] = await db
        .update(channelConnections)
        .set({
          outboundToken: crypto.randomUUID().replaceAll("-", ""),
          updatedAt: new Date(),
        })
        .where(eq(channelConnections.id, id))
        .returning();
      if (!row) throw new Error("Channel connection not found");
      return toConnection(row);
    },
    recordPollResult: async (input: RecordPollResultInput) => {
      const [row] = await db
        .update(channelConnections)
        .set({
          lastPolledAt: input.at ?? new Date(),
          lastPollStatus: input.status,
          lastPollEventCount: input.eventCount,
          lastPollError: input.error,
          updatedAt: new Date(),
        })
        .where(eq(channelConnections.id, input.connectionId))
        .returning();
      if (!row) throw new Error("Channel connection not found");
      return toConnection(row);
    },
    getInboundFeedUrl: async (id: string) =>
      (await findById(id)).inboundFeedUrl ?? undefined,
  });
}
