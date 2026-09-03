import "server-only";
import { createProductionDatabase } from "@/infrastructure/database/client";
import {
  listOperationalAlerts,
  recordOperationalAlert,
  type OperationalAlertRow,
} from "@/infrastructure/database/operational-alerts-source";
import { createDatabaseBoundary } from "@/infrastructure/database/server";

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

function fromRow(row: OperationalAlertRow): ChannelSyncConflictAlert {
  return Object.freeze({
    id: row.id,
    roomId: row.roomId ?? "",
    existingReservationId: row.reservationId ?? undefined,
    message: row.message,
    createdAt: row.createdAt,
  });
}

/**
 * Shared emitter for both detection points described in design.md decision
 * 5 (ingestion-time `RoomLockConflictError`, and the Fintoc webhook's
 * `HoldExpiredError` caused by a channel-sync arrival): the same alert,
 * from one place, regardless of which side lost the race. Persists to
 * `operational_alerts` under production, to the in-process mock store
 * otherwise (see `wire-admin-alerts-production` design.md decision 2).
 */
export async function recordChannelSyncConflictAlert(
  input: Readonly<{ roomId: string; existingReservationId?: string }>
): Promise<ChannelSyncConflictAlert> {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    const alert: ChannelSyncConflictAlert = Object.freeze({
      id: crypto.randomUUID(),
      roomId: input.roomId,
      existingReservationId: input.existingReservationId,
      message: CHANNEL_SYNC_CONFLICT_MESSAGE,
      createdAt: new Date(),
    });
    getConflictAlerts().push(alert);
    return alert;
  }
  const db = createProductionDatabase(boundary);
  const row = await recordOperationalAlert(db, {
    kind: "channel_sync_conflict",
    message: CHANNEL_SYNC_CONFLICT_MESSAGE,
    reservationId: input.existingReservationId,
    roomId: input.roomId,
  });
  return fromRow(row);
}

export async function listChannelSyncConflictAlerts(): Promise<
  readonly ChannelSyncConflictAlert[]
> {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return Object.freeze([...getConflictAlerts()]);
  }
  const db = createProductionDatabase(boundary);
  const rows = await listOperationalAlerts(db);
  return Object.freeze(
    rows
      .filter((row) => row.kind === "channel_sync_conflict")
      .map(fromRow)
  );
}
