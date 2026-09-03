import "server-only";
import { listChannelSyncConflictAlerts } from "@/features/channel-calendar-sync";
import { getMockNotificationOutboxRepository } from "@/features/notifications";
import {
  getMockReservationSummaryById,
  listMockReservationPaymentAdminViews,
  type ReservationOrigin,
} from "@/features/reservations";
import { queryPendingPayAtPropertyPayments } from "@/infrastructure/database/admin-pending-payments-source";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { getReservationSummaryById } from "@/infrastructure/database/reservation-summary-source";
import { createDatabaseBoundary } from "@/infrastructure/database/server";

export type OperationalAlert = Readonly<{
  id: string;
  kind: "notification_failure" | "payment_pending" | "channel_sync_conflict";
  label: string;
  reservationId?: string;
  status?: string;
  /** Who/how much/which channel the reservation behind this alert is - lets an admin triage from this list without opening every reservation. */
  guestName?: string;
  origin?: ReservationOrigin;
  totalClp?: number;
}>;

/**
 * Mock-only: `notification_failure` has no production reader yet (see
 * design.md "Non-Goals" - `getScheduledOutboxProcessor()` never runs
 * outside mock, so no `notification_outbox` row ever reaches `failed` in
 * production). Reads the real mock outbox instead of a hardcoded demo item,
 * matching `notification-delivery-status.ts`.
 */
function mockNotificationFailureAlerts(): readonly OperationalAlert[] {
  const outbox = getMockNotificationOutboxRepository();
  if (!outbox) return [];
  return Object.freeze(
    outbox
      .list()
      .filter(
        (intent) => intent.status === "failed" || intent.status === "retrying"
      )
      .map((intent) =>
        Object.freeze({
          id: `notification-${intent.id}`,
          kind: "notification_failure" as const,
          label: "Notificación pendiente de revisión",
          reservationId: intent.reservationId,
          status: intent.status,
        })
      )
  );
}

function paymentPendingAlerts(
  views: readonly Readonly<{
    id: string;
    paymentStatus: string;
    guestName?: string;
    origin?: string;
    totalClp?: number;
  }>[]
): readonly OperationalAlert[] {
  return Object.freeze(
    views
      .filter((item) => item.paymentStatus === "pending")
      .map((item) =>
        Object.freeze({
          id: `payment-${item.id}`,
          kind: "payment_pending" as const,
          label: "Pago al llegar pendiente",
          reservationId: item.id,
          status: item.paymentStatus,
          guestName: item.guestName,
          origin: item.origin as ReservationOrigin | undefined,
          totalClp: item.totalClp,
        })
      )
  );
}

type ReservationSummaryLookup = (
  reservationId: string
) => Promise<Readonly<{
  guestName?: string;
  origin: ReservationOrigin;
  totalClp: number;
}> | null>;

/** One lookup per conflict alert: these are rare (a genuine double-booking), unlike pending payments, which batches because it lists every row at once. */
async function channelSyncConflictAlerts(
  conflicts: readonly Readonly<{
    id: string;
    message: string;
    existingReservationId?: string;
  }>[],
  lookupReservation: ReservationSummaryLookup
): Promise<readonly OperationalAlert[]> {
  return Object.freeze(
    await Promise.all(
      conflicts.map(async (conflict) => {
        const summary = conflict.existingReservationId
          ? await lookupReservation(conflict.existingReservationId)
          : null;
        return Object.freeze({
          id: conflict.id,
          kind: "channel_sync_conflict" as const,
          label: conflict.message,
          reservationId: conflict.existingReservationId,
          guestName: summary?.guestName,
          origin: summary?.origin,
          totalClp: summary?.totalClp,
        });
      })
    )
  );
}

export async function getOperationalAlerts(): Promise<
  readonly OperationalAlert[]
> {
  const boundary = createDatabaseBoundary();
  const rawConflicts = await listChannelSyncConflictAlerts();

  if (boundary.context !== "production") {
    const [reservations, conflicts] = await Promise.all([
      listMockReservationPaymentAdminViews(),
      channelSyncConflictAlerts(rawConflicts, getMockReservationSummaryById),
    ]);
    return Object.freeze([
      ...mockNotificationFailureAlerts(),
      ...paymentPendingAlerts(reservations),
      ...conflicts,
    ]);
  }

  const db = createProductionDatabase(boundary);
  const [pendingPayments, conflicts] = await Promise.all([
    queryPendingPayAtPropertyPayments(db),
    channelSyncConflictAlerts(rawConflicts, (id) =>
      getReservationSummaryById(db, id)
    ),
  ]);
  return Object.freeze([...paymentPendingAlerts(pendingPayments), ...conflicts]);
}
