import {
  confirmPayNowReservationFromHold,
  HoldExpiredError,
  releaseFailedPayNowHold,
  type GuestRepository,
  type HoldRepository,
  type ReservationRepository,
} from "@/features/reservations";
import type { RoomLockGateway } from "@/features/availability";
import type { NotificationOutboxWriter } from "@/features/notifications";

import { recordPaymentChargebackAlert } from "./chargeback-alert";
import type { FintocPaymentRecord, FintocPaymentRepository } from "./fintoc-payment-repository";
import type { NormalizedPaymentEvent } from "./online-payment-provider";

export type ProcessOnlinePaymentWebhookEventParams<TContext> = Readonly<{
  event: NormalizedPaymentEvent;
  guestRepository: GuestRepository<TContext>;
  /** Optional so tests/callers that don't care about notifications can omit it. */
  notificationOutboxWriter?: NotificationOutboxWriter<TContext> | null;
  /** e.g. `"fintoc"` or `"mercado_pago"` — passed through to `confirmPayNowReservationFromHold`. */
  paymentProvider: string;
  paymentRepository: FintocPaymentRepository;
  holdRepository: HoldRepository<TContext>;
  reservationRepository: ReservationRepository<TContext>;
  roomLockGateway: RoomLockGateway<TContext>;
}>;

export type ProcessOnlinePaymentWebhookEventResult =
  | Readonly<{ outcome: "ignored_duplicate" }>
  | Readonly<{ outcome: "payment_not_found" }>
  | Readonly<{ outcome: "reservation_confirmed" }>
  | Readonly<{ outcome: "hold_expired" }>
  | Readonly<{ outcome: "payment_failed" }>
  | Readonly<{ outcome: "requires_action" }>
  | Readonly<{ outcome: "charged_back" }>
  | Readonly<{ outcome: "no_action" }>;

function isFinalStatus(status: FintocPaymentRecord["status"]) {
  return status !== "pending" && status !== "requires_action";
}

/**
 * Provider-agnostic core of online-payment webhook processing (see
 * `add-mercado-pago-checkout-pro` design.md decision 2). The caller must
 * have already verified the request's signature and recorded the event id
 * for idempotency via `paymentRepository.recordWebhookEvent` before
 * calling this — this function assumes the event is new.
 *
 * `processFintocWebhookEvent` (`./fintoc-webhook.ts`) is a thin wrapper
 * around this function for Fintoc, kept as its own name/shape for
 * backward compatibility with existing call sites and tests.
 */
export async function processOnlinePaymentWebhookEvent<TContext>(
  params: ProcessOnlinePaymentWebhookEventParams<TContext>
): Promise<ProcessOnlinePaymentWebhookEventResult> {
  const {
    event,
    guestRepository,
    notificationOutboxWriter,
    paymentProvider,
    paymentRepository,
    holdRepository,
    reservationRepository,
    roomLockGateway,
  } = params;

  const payment = event.externalReference
    ? await paymentRepository.getPaymentByExternalReference(
        event.externalReference
      )
    : event.paymentIntentId
      ? await paymentRepository.getPaymentByProviderPaymentId(
          event.paymentIntentId
        )
      : null;
  if (!payment) {
    return Object.freeze({ outcome: "payment_not_found" });
  }

  // A contracargo always arrives against an already-`approved` payment —
  // handled before the "already final" short-circuit below, since
  // `approved` IS a final state for every other event type.
  if (event.paymentIntentStatus === "charged_back") {
    if (payment.status !== "approved") {
      return Object.freeze({ outcome: "ignored_duplicate" });
    }
    const chargedBack = await paymentRepository.markChargedBack(payment);
    if (chargedBack.reservationId) {
      await recordPaymentChargebackAlert({
        reservationId: chargedBack.reservationId,
      });
    }
    return Object.freeze({ outcome: "charged_back" });
  }

  if (!payment.holdId) {
    return Object.freeze({ outcome: "payment_not_found" });
  }
  // Already in a final state (a retried/duplicate event that slipped past
  // event-id idempotency, e.g. a redelivery with a new event id).
  if (isFinalStatus(payment.status)) {
    return Object.freeze({ outcome: "ignored_duplicate" });
  }

  const hold = await holdRepository.getHoldById(payment.holdId);

  if (event.sessionExpiredWithoutPayment) {
    await paymentRepository.markFailed(payment, "cancelled");
    if (hold) {
      await releaseFailedPayNowHold({ hold, holdRepository, roomLockGateway });
    }
    return Object.freeze({ outcome: "payment_failed" });
  }

  if (!event.paymentIntentId) {
    return Object.freeze({ outcome: "no_action" });
  }
  const paymentIntentId = event.paymentIntentId;

  switch (event.paymentIntentStatus) {
    case "succeeded": {
      if (!hold) return Object.freeze({ outcome: "payment_not_found" });
      try {
        const confirmed = await confirmPayNowReservationFromHold({
          guestRepository,
          hold,
          holdRepository,
          notificationOutboxWriter,
          paymentExternalReference: payment.externalReference,
          paymentId: payment.id,
          paymentProvider,
          providerPaymentId: paymentIntentId,
          reservationRepository,
          roomLockGateway,
        });
        await paymentRepository.markApproved(payment, {
          providerPaymentId: paymentIntentId,
          reservationId: confirmed.reservation.id,
        });
        return Object.freeze({ outcome: "reservation_confirmed" });
      } catch (error) {
        if (error instanceof HoldExpiredError) {
          return Object.freeze({ outcome: "hold_expired" });
        }
        throw error;
      }
    }
    case "failed":
    case "rejected":
    case "expired": {
      const status =
        event.paymentIntentStatus === "expired" ? "cancelled" : "rejected";
      await paymentRepository.markFailed(payment, status, paymentIntentId);
      if (hold) {
        await releaseFailedPayNowHold({ hold, holdRepository, roomLockGateway });
      }
      return Object.freeze({ outcome: "payment_failed" });
    }
    case "requires_action": {
      await paymentRepository.markRequiresAction(payment, paymentIntentId);
      return Object.freeze({ outcome: "requires_action" });
    }
    default:
      return Object.freeze({ outcome: "no_action" });
  }
}
