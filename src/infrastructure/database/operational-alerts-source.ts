import "server-only";

import { desc } from "drizzle-orm";

import { operationalAlerts } from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

/** Mirrors the `operational_alert_kind` Drizzle enum. Only `channel_sync_conflict` is written today; the table stays generic for a future alert-event (see design.md). */
export type OperationalAlertKind = "channel_sync_conflict";

export type OperationalAlertRow = Readonly<{
  id: string;
  kind: OperationalAlertKind;
  roomId: string | null;
  reservationId: string | null;
  message: string;
  createdAt: Date;
}>;

export type RecordOperationalAlertInput = Readonly<{
  kind: OperationalAlertKind;
  roomId?: string;
  reservationId?: string;
  message: string;
}>;

/**
 * Persists an alert-event that has no other row to be derived from (unlike
 * `notification_failure`/`payment_pending`, which stay as queries over
 * `notification_outbox`/`payments`). See design.md decision 1.
 */
export async function recordOperationalAlert(
  db: ProductionDatabase,
  input: RecordOperationalAlertInput
): Promise<OperationalAlertRow> {
  const [row] = await db
    .insert(operationalAlerts)
    .values({
      kind: input.kind,
      message: input.message,
      reservationId: input.reservationId,
      roomId: input.roomId,
    })
    .returning();
  if (!row) throw new Error("Failed to insert operational alert: no row returned");
  return row;
}

export async function listOperationalAlerts(
  db: ProductionDatabase
): Promise<readonly OperationalAlertRow[]> {
  return db
    .select()
    .from(operationalAlerts)
    .orderBy(desc(operationalAlerts.createdAt));
}
