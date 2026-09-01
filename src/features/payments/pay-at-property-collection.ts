import "server-only";
import { getServerEnvironment } from "@/config/server";
import {
  getNotificationOutboxWriter,
  type NotificationOutboxWriter,
} from "@/features/notifications";
import {
  approveMockPayAtPropertyPaymentByReservationId,
  getMockPendingPaymentByReservationId,
  mockReservationRepository,
} from "@/features/reservations";
import {
  captureServerException,
  writeStructuredLog,
} from "@/infrastructure/observability/sentry";
export type PayAtPropertyCollection = Readonly<{
  reservationId: string;
  amountClp: number;
  collectedOn: string;
  medium: string;
  actor: string;
  status: "approved";
}>;
const collections: PayAtPropertyCollection[] = [];
export function createPayAtPropertyCollectionService(
  notificationOutboxWriter: NotificationOutboxWriter<unknown> | null
) {
  if (!notificationOutboxWriter) return null;
  return {
    collect: async (
      input: {
        reservationId: string;
        amountClp: number;
        collectedOn: string;
        medium: string;
      },
      actor: string
    ) => {
      const record = await getMockPendingPaymentByReservationId(
        input.reservationId
      );
      if (!record) throw new Error("Pending payment not found");
      const totalClp = record.payment.amountClp;
      if (
        !Number.isSafeInteger(input.amountClp) ||
        input.amountClp !== totalClp ||
        input.amountClp < 0
      )
        throw new Error("Payment amount must equal total");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(input.collectedOn) ||
        !input.medium.trim()
      )
        throw new Error("Invalid collection data");
      if (collections.some((x) => x.reservationId === input.reservationId))
        throw new Error("Payment already collected");
      const payment = await approveMockPayAtPropertyPaymentByReservationId(
        input.reservationId
      );
      if (!payment || payment.status !== "approved")
        throw new Error("Pending payment not found");
      const result = Object.freeze({
        reservationId: input.reservationId,
        amountClp: input.amountClp,
        collectedOn: input.collectedOn,
        medium: input.medium.trim(),
        actor,
        status: payment.status,
      });
      try {
        await notificationOutboxWriter.writePaymentCollected(undefined, {
          payment,
          reservation: record.reservation,
        });
        collections.push(result);
        writeStructuredLog("info", "payment.collected", {
          paymentId: payment.id,
          reservationId: record.reservation.id,
          status: payment.status,
        });
        return result;
      } catch (error) {
        await mockReservationRepository.restorePendingPayAtPropertyPayment?.(
          input.reservationId
        );
        await captureServerException("payment.collection_failed", error, {
          reservationId: input.reservationId,
        });
        throw error;
      }
    },
    list: () => Object.freeze([...collections]),
  };
}

export function getPayAtPropertyCollectionService() {
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return null;
  return createPayAtPropertyCollectionService(getNotificationOutboxWriter());
}
