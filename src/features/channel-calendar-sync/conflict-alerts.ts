import "server-only";
import { getServerEnvironment } from "@/config/server";

export const CHANNEL_SYNC_CONFLICT_MESSAGE =
  "He encontrado una reserva sobreduplicada para web y airbnb/booking. Revise la reserva para coordinar con huésped.";

export type ChannelSyncConflictAlert = Readonly<{
  id: string;
  roomId: string;
  /** The reservation/hold already present when the conflict was detected, when known. */
  existingReservationId?: string;
  message: string;
  createdAt: Date;
}>;

const conflictAlertsKey = Symbol.for(
  "vista-valle.mock.channel-sync-conflict-alerts"
);

function getConflictAlerts(): ChannelSyncConflictAlert[] {
  const scope = globalThis as typeof globalThis & {
    [key: symbol]: ChannelSyncConflictAlert[] | undefined;
  };
  return (scope[conflictAlertsKey] ??= []);
}

/**
 * Shared emitter for both detection points described in design.md decision
 * 5 (ingestion-time `RoomLockConflictError`, and the Fintoc webhook's
 * `HoldExpiredError` caused by a channel-sync arrival): the same alert,
 * from one place, regardless of which side lost the race.
 */
export function recordChannelSyncConflictAlert(
  input: Readonly<{ roomId: string; existingReservationId?: string }>
): ChannelSyncConflictAlert {
  const alert: ChannelSyncConflictAlert = Object.freeze({
    id: crypto.randomUUID(),
    roomId: input.roomId,
    existingReservationId: input.existingReservationId,
    message: CHANNEL_SYNC_CONFLICT_MESSAGE,
    createdAt: new Date(),
  });
  // No persistence outside the mock adapter yet (see design.md decision 13);
  // still returns the alert so a caller's own error handling/logging
  // continues to work under `production` even before that adapter exists.
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT === "mock")
    getConflictAlerts().push(alert);
  return alert;
}

export function listChannelSyncConflictAlerts(): readonly ChannelSyncConflictAlert[] {
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return [];
  return Object.freeze([...getConflictAlerts()]);
}
