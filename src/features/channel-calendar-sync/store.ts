import "server-only";

import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleChannelConnectionRepository } from "@/infrastructure/database/channel-connections-repository";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import {
  getChannelConnections,
  type AsyncChannelConnectionStore,
} from "./connections";

export function getChannelConnectionStore(): AsyncChannelConnectionStore | null {
  const mock = getChannelConnections();
  if (mock)
    return {
      list: async () => mock.list(),
      listActive: async () => mock.listActive(),
      getByRoomAndPlatform: async (roomId, platform) =>
        mock.getByRoomAndPlatform(roomId, platform),
      getByOutboundToken: async (token) => mock.getByOutboundToken(token),
      setInboundFeedUrl: async (input) => mock.setInboundFeedUrl(input),
      setEnabled: async (id, enabled) => mock.setEnabled(id, enabled),
      regenerateOutboundToken: async (id) => mock.regenerateOutboundToken(id),
      recordPollResult: async (input) => mock.recordPollResult(input),
      getInboundFeedUrl: async (id) => mock.getInboundFeedUrl(id),
    };
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") return null;
  return createDrizzleChannelConnectionRepository(
    createProductionDatabase(boundary)
  );
}
