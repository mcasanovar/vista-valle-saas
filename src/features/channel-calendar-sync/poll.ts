import "server-only";
import { getChannelConnectionStore } from "./store";
import type { ChannelConnection } from "./connections";
import { ingestChannelConnection } from "./ingest";
import { writeStructuredLog } from "@/infrastructure/observability/sentry";

export type ChannelSyncPollOutcome = Readonly<{
  connectionId: string;
  status: "ok" | "error" | "skipped";
  eventCount?: number;
  error?: string;
}>;

async function defaultFetchIcal(url: string): Promise<string> {
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(
      `Inbound feed request failed with status ${response.status}`
    );
  }
  return response.text();
}

/**
 * Polls every active channel connection's inbound feed and ingests it (spec
 * "Cadencia de sondeo configurable": this function is what a cron of any
 * frequency calls; the frequency itself lives outside the application). A
 * failure on one connection (network error, malformed feed) is recorded on
 * that connection and does not stop the others from being polled.
 */
export async function pollAllActiveConnections(
  fetchIcal: (url: string) => Promise<string> = defaultFetchIcal
): Promise<readonly ChannelSyncPollOutcome[]> {
  const connections = getChannelConnectionStore();
  if (!connections) return [];

  const outcomes: ChannelSyncPollOutcome[] = [];
  for (const connection of await connections.listActive()) {
    const inboundFeedUrl = await connections.getInboundFeedUrl(connection.id);
    if (!inboundFeedUrl) {
      outcomes.push({ connectionId: connection.id, status: "skipped" });
      continue;
    }
    outcomes.push(
      await pollOneConnection(connection, inboundFeedUrl, fetchIcal)
    );
  }
  return Object.freeze(outcomes);
}

async function pollOneConnection(
  connection: ChannelConnection,
  inboundFeedUrl: string,
  fetchIcal: (url: string) => Promise<string>
): Promise<ChannelSyncPollOutcome> {
  const connections = getChannelConnectionStore()!;
  try {
    const document = await fetchIcal(inboundFeedUrl);
    const result = await ingestChannelConnection(connection, document);
    const eventCount = result.created.length + result.cancelled.length;
    await connections.recordPollResult({
      connectionId: connection.id,
      status: "ok",
      eventCount,
    });
    writeStructuredLog("info", "channel_sync.poll_completed", {
      channelConnectionId: connection.id,
      eventCount,
      platform: connection.platform,
    });
    return { connectionId: connection.id, status: "ok", eventCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await connections.recordPollResult({
      connectionId: connection.id,
      status: "error",
      error: message,
    });
    writeStructuredLog("error", "channel_sync.poll_failed", {
      channelConnectionId: connection.id,
      platform: connection.platform,
    });
    return { connectionId: connection.id, status: "error", error: message };
  }
}
