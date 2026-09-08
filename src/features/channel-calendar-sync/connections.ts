import "server-only";
import { getServerEnvironment } from "@/config/server";

export type ChannelPlatform = "airbnb" | "booking";
export type ChannelPaymentBehavior = "auto_approved" | "pay_at_property";
export type ChannelConnectionPollStatus = "ok" | "error";

export type ChannelConnection = Readonly<{
  id: string;
  roomId: string;
  platform: ChannelPlatform;
  paymentBehavior: ChannelPaymentBehavior;
  /** Present only when an inbound feed URL has been saved; never re-exposes the URL itself (see `channel-calendar-sync` spec: "write-only after saving"). */
  hasInboundFeedUrl: boolean;
  outboundToken: string;
  enabled: boolean;
  lastPolledAt?: Date;
  lastPollStatus?: ChannelConnectionPollStatus;
  lastPollEventCount?: number;
  lastPollError?: string;
}>;

export type ChannelConnectionStore = Readonly<{
  list: () => readonly ChannelConnection[];
  listActive: () => readonly ChannelConnection[];
  getByRoomAndPlatform: (
    roomId: string,
    platform: ChannelPlatform
  ) => ChannelConnection | null;
  getByOutboundToken: (token: string) => ChannelConnection | null;
  setInboundFeedUrl: (input: SetInboundFeedUrlInput) => ChannelConnection;
  setEnabled: (id: string, enabled: boolean) => ChannelConnection;
  regenerateOutboundToken: (id: string) => ChannelConnection;
  recordPollResult: (input: RecordPollResultInput) => ChannelConnection;
  getInboundFeedUrl: (id: string) => string | undefined;
}>;

export type AsyncChannelConnectionStore = Readonly<{
  list: () => Promise<readonly ChannelConnection[]>;
  listActive: () => Promise<readonly ChannelConnection[]>;
  getByRoomAndPlatform: (
    roomId: string,
    platform: ChannelPlatform
  ) => Promise<ChannelConnection | null>;
  getByOutboundToken: (token: string) => Promise<ChannelConnection | null>;
  setInboundFeedUrl: (
    input: SetInboundFeedUrlInput
  ) => Promise<ChannelConnection>;
  setEnabled: (id: string, enabled: boolean) => Promise<ChannelConnection>;
  regenerateOutboundToken: (id: string) => Promise<ChannelConnection>;
  recordPollResult: (
    input: RecordPollResultInput
  ) => Promise<ChannelConnection>;
  getInboundFeedUrl: (id: string) => Promise<string | undefined>;
}>;

export type SetInboundFeedUrlInput = Readonly<{
  roomId: string;
  platform: ChannelPlatform;
  inboundFeedUrl: string;
  paymentBehavior: ChannelPaymentBehavior;
}>;

export type RecordPollResultInput = Readonly<{
  connectionId: string;
  status: ChannelConnectionPollStatus;
  eventCount?: number;
  error?: string;
  at?: Date;
}>;

function generateOutboundToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

type InternalChannelConnection = ChannelConnection &
  Readonly<{ inboundFeedUrl?: string }>;

const connectionsKey = Symbol.for("vista-valle.mock.channel-connections");

function getConnections(): InternalChannelConnection[] {
  const scope = globalThis as typeof globalThis & {
    [key: symbol]: InternalChannelConnection[] | undefined;
  };
  return (scope[connectionsKey] ??= []);
}

function toPublic(connection: InternalChannelConnection): ChannelConnection {
  return Object.freeze({
    id: connection.id,
    roomId: connection.roomId,
    platform: connection.platform,
    paymentBehavior: connection.paymentBehavior,
    hasInboundFeedUrl: connection.hasInboundFeedUrl,
    outboundToken: connection.outboundToken,
    enabled: connection.enabled,
    lastPolledAt: connection.lastPolledAt,
    lastPollStatus: connection.lastPollStatus,
    lastPollEventCount: connection.lastPollEventCount,
    lastPollError: connection.lastPollError,
  });
}

/**
 * Mock-first adapter for channel connections (design.md decision 7 of
 * `automate-channel-calendar-sync`). Opens no network connections under the
 * `mock` config context; a Drizzle-backed adapter for the `production`
 * context is a separate task, not yet built.
 */
export function getChannelConnections() {
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return null;
  const store = getConnections();
  return Object.freeze({
    list: () => Object.freeze(store.map(toPublic)),
    listActive: () =>
      Object.freeze(store.filter((c) => c.enabled).map(toPublic)),
    getByRoomAndPlatform: (roomId: string, platform: ChannelPlatform) => {
      const found = store.find(
        (c) => c.roomId === roomId && c.platform === platform
      );
      return found ? toPublic(found) : null;
    },
    getByOutboundToken: (token: string) => {
      const found = store.find((c) => c.outboundToken === token);
      return found ? toPublic(found) : null;
    },
    /** Creates the connection if none exists for this room+platform, or replaces its inbound feed URL and payment behavior otherwise. Never returns the stored URL. */
    setInboundFeedUrl: (input: SetInboundFeedUrlInput): ChannelConnection => {
      const existing = store.find(
        (c) => c.roomId === input.roomId && c.platform === input.platform
      );
      if (existing) {
        const next: InternalChannelConnection = {
          ...existing,
          inboundFeedUrl: input.inboundFeedUrl,
          hasInboundFeedUrl: true,
          paymentBehavior: input.paymentBehavior,
        };
        store.splice(store.indexOf(existing), 1, next);
        return toPublic(next);
      }
      const created: InternalChannelConnection = Object.freeze({
        id: crypto.randomUUID(),
        roomId: input.roomId,
        platform: input.platform,
        paymentBehavior: input.paymentBehavior,
        inboundFeedUrl: input.inboundFeedUrl,
        hasInboundFeedUrl: true,
        outboundToken: generateOutboundToken(),
        enabled: false,
      });
      store.push(created);
      return toPublic(created);
    },
    setEnabled: (id: string, enabled: boolean): ChannelConnection => {
      const current = store.find((c) => c.id === id);
      if (!current) throw new Error("Channel connection not found");
      const next = Object.freeze({ ...current, enabled });
      store.splice(store.indexOf(current), 1, next);
      return toPublic(next);
    },
    regenerateOutboundToken: (id: string): ChannelConnection => {
      const current = store.find((c) => c.id === id);
      if (!current) throw new Error("Channel connection not found");
      const next = Object.freeze({
        ...current,
        outboundToken: generateOutboundToken(),
      });
      store.splice(store.indexOf(current), 1, next);
      return toPublic(next);
    },
    recordPollResult: (input: RecordPollResultInput): ChannelConnection => {
      const current = store.find((c) => c.id === input.connectionId);
      if (!current) throw new Error("Channel connection not found");
      const next = Object.freeze({
        ...current,
        lastPolledAt: input.at ?? new Date(),
        lastPollStatus: input.status,
        lastPollEventCount: input.eventCount,
        lastPollError: input.error,
      });
      store.splice(store.indexOf(current), 1, next);
      return toPublic(next);
    },
    /** Internal accessor for the inbound feed URL, used only by the polling job — never exposed through `toPublic`. */
    getInboundFeedUrl: (id: string) =>
      store.find((c) => c.id === id)?.inboundFeedUrl,
  });
}
