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

/** All supported platforms, used to seed a default (unpaused) state for a platform with no row yet. */
export const CHANNEL_PLATFORMS: readonly ChannelPlatform[] = Object.freeze([
  "airbnb",
  "booking",
]);

export type ChannelConnectionStore = Readonly<{
  list: () => readonly ChannelConnection[];
  listActive: () => readonly ChannelConnection[];
  getByRoomAndPlatform: (
    roomId: string,
    platform: ChannelPlatform
  ) => ChannelConnection | null;
  getByOutboundToken: (token: string) => ChannelConnection | null;
  setInboundFeedUrl: (input: SetInboundFeedUrlInput) => ChannelConnection;
  /**
   * Creates a connection with no inbound feed URL yet, only an outbound
   * token — Booking-only escape hatch (see `createBookingChannelConnectionAction`
   * in `actions.ts`): unlike Airbnb, Booking's own UI requires our outbound
   * link before it hands out its inbound one, so an admin needs to generate
   * ours first. Throws if a connection already exists for this room+platform.
   */
  createPendingConnection: (
    roomId: string,
    platform: ChannelPlatform,
    paymentBehavior: ChannelPaymentBehavior
  ) => ChannelConnection;
  setEnabled: (id: string, enabled: boolean) => ChannelConnection;
  regenerateOutboundToken: (id: string) => ChannelConnection;
  recordPollResult: (input: RecordPollResultInput) => ChannelConnection;
  getInboundFeedUrl: (id: string) => string | undefined;
  /**
   * Whether a platform's sync (inbound polling and outbound feed) is
   * currently paused (design.md decision 2 of
   * "allow-full-reservation-editing-and-ota-sync-toggle"). A platform with
   * no stored pause row defaults to `false` (not paused).
   */
  isPlatformPaused: (platform: ChannelPlatform) => boolean;
  /** Pauses/resumes a platform without touching any connection's `enabled` value. */
  setPlatformPaused: (
    platform: ChannelPlatform,
    paused: boolean
  ) => ChannelPlatformPauseState;
  listPlatformPauseStates: () => readonly ChannelPlatformPauseState[];
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
  createPendingConnection: (
    roomId: string,
    platform: ChannelPlatform,
    paymentBehavior: ChannelPaymentBehavior
  ) => Promise<ChannelConnection>;
  setEnabled: (id: string, enabled: boolean) => Promise<ChannelConnection>;
  regenerateOutboundToken: (id: string) => Promise<ChannelConnection>;
  recordPollResult: (
    input: RecordPollResultInput
  ) => Promise<ChannelConnection>;
  getInboundFeedUrl: (id: string) => Promise<string | undefined>;
  isPlatformPaused: (platform: ChannelPlatform) => Promise<boolean>;
  setPlatformPaused: (
    platform: ChannelPlatform,
    paused: boolean
  ) => Promise<ChannelPlatformPauseState>;
  listPlatformPauseStates: () => Promise<readonly ChannelPlatformPauseState[]>;
}>;

export type ChannelPlatformPauseState = Readonly<{
  platform: ChannelPlatform;
  paused: boolean;
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
const platformPausesKey = Symbol.for(
  "vista-valle.mock.channel-platform-pauses"
);

function getConnections(): InternalChannelConnection[] {
  const scope = globalThis as typeof globalThis & {
    [key: symbol]: InternalChannelConnection[] | undefined;
  };
  return (scope[connectionsKey] ??= []);
}

function getPlatformPauses(): Map<ChannelPlatform, boolean> {
  const scope = globalThis as typeof globalThis & {
    [key: symbol]: Map<ChannelPlatform, boolean> | undefined;
  };
  return (scope[platformPausesKey] ??= new Map());
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
    createPendingConnection: (
      roomId: string,
      platform: ChannelPlatform,
      paymentBehavior: ChannelPaymentBehavior
    ): ChannelConnection => {
      const existing = store.find(
        (c) => c.roomId === roomId && c.platform === platform
      );
      if (existing) throw new Error("Channel connection already exists");
      const created: InternalChannelConnection = Object.freeze({
        id: crypto.randomUUID(),
        roomId,
        platform,
        paymentBehavior,
        hasInboundFeedUrl: false,
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
    isPlatformPaused: (platform: ChannelPlatform) =>
      getPlatformPauses().get(platform) ?? false,
    setPlatformPaused: (
      platform: ChannelPlatform,
      paused: boolean
    ): ChannelPlatformPauseState => {
      getPlatformPauses().set(platform, paused);
      return Object.freeze({ platform, paused });
    },
    listPlatformPauseStates: (): readonly ChannelPlatformPauseState[] => {
      const pauses = getPlatformPauses();
      return Object.freeze(
        CHANNEL_PLATFORMS.map((platform) =>
          Object.freeze({ platform, paused: pauses.get(platform) ?? false })
        )
      );
    },
  });
}
