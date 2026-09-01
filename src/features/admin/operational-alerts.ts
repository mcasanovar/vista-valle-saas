import "server-only";
import { getServerEnvironment } from "@/config/server";
import { listMockReservationPaymentAdminViews } from "@/features/reservations";
import { listChannelSyncConflictAlerts } from "@/features/channel-calendar-sync";
export type OperationalAlert = Readonly<{
  id: string;
  kind: "notification_failure" | "payment_pending" | "channel_sync_conflict";
  label: string;
  reservationId?: string;
  status?: string;
}>;
export async function getOperationalAlerts() {
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return null;
  const reservations = await listMockReservationPaymentAdminViews();
  const conflicts = listChannelSyncConflictAlerts();
  return Object.freeze([
    Object.freeze({
      id: "notification-failure-demo",
      kind: "notification_failure" as const,
      label: "Notificación pendiente de revisión",
    }),
    ...reservations
      .filter((item) => item.paymentStatus === "pending")
      .map((item) =>
        Object.freeze({
          id: `payment-${item.id}`,
          kind: "payment_pending" as const,
          label: "Pago al llegar pendiente",
          reservationId: item.id,
          status: item.paymentStatus,
        })
      ),
    ...conflicts.map((conflict) =>
      Object.freeze({
        id: conflict.id,
        kind: "channel_sync_conflict" as const,
        label: conflict.message,
        reservationId: conflict.existingReservationId,
      })
    ),
  ]);
}
