import "server-only";
import { getChannelConnections, type ChannelConnection } from "./connections";
import { ingestChannelConnection } from "./ingest";

export type ChannelSyncPollOutcome = Readonly<{
  connectionId: string;
  status: "ok" | "error" | "skipped";
  eventCount?: number;
  error?: string;
}>;

async function defaultFetchIcal(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Inbound feed request failed with status ${response.status}`);
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
  const connections = getChannelConnections();
  if (!connections) return [];

  const outcomes: ChannelSyncPollOutcome[] = [];
  for (const connection of connections.listActive()) {
    const inboundFeedUrl = connections.getInboundFeedUrl(connection.id);
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
  const connections = getChannelConnections()!;
  try {
    const document = await fetchIcal(inboundFeedUrl);
    const result = await ingestChannelConnection(connection, document);
    const eventCount = result.created.length + result.cancelled.length;
    connections.recordPollResult({
      connectionId: connection.id,
      status: "ok",
      eventCount,
    });
    return { connectionId: connection.id, status: "ok", eventCount };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    connections.recordPollResult({
      connectionId: connection.id,
      status: "error",
      error: message,
    });
    return { connectionId: connection.id, status: "error", error: message };
  }
}
