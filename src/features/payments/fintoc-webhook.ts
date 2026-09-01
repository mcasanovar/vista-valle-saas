import {
  confirmPayNowReservationFromHold,
  HoldExpiredError,
  releaseFailedPayNowHold,
  type HoldRepository,
  type ReservationRepository,
} from "@/features/reservations";
import type { RoomLockGateway } from "@/features/availability";

import type { FintocPaymentRepository } from "./fintoc-payment-repository";

/**
 * The subset of a Fintoc event this handler understands, after
 * `parseFintocWebhookEvent` normalizes the two raw shapes Fintoc actually
 * sends: `checkout_session.finished`/`checkout_session.expired` (whose
 * `data` is a checkout session, with the payment intent nested under
 * `data.payment_resource.payment_intent`) and `payment_intent.*` (whose
 * `data` IS the payment intent directly, per
 * `/api/main-resources/events-reference/events-get`).
 *
 * `payment_intent.*` events carry no checkout-session reference at all, so
 * they can only be correlated by `paymentIntentId` — hence at least one of
 * `checkoutSessionId`/`paymentIntentId` is always present, but neither is
 * guaranteed alone (`checkout_session.expired` with no payment ever
 * started has no payment intent either).
 *
 * `paymentIntentStatus` is read from the payment intent object's own
 * `status` field (per its object reference: `created`, `in_progress`,
 * `succeeded`, `failed`, `pending`, `requires_action`, `expired`,
 * `rejected`) — never guessed from the event `type` name. Fintoc's own
 * guide (as of writing) lists a `payment_intent.requires_action` *event*
 * that does not appear in the authoritative event-type enum; `requires_action`
 * is only ever a `status` value, most likely delivered inside a
 * `payment_intent.pending` event.
 */
export type FintocWebhookEvent = Readonly<{
  checkoutSessionId?: string;
  id: string;
  occurredAt: Date;
  paymentIntentId?: string;
  paymentIntentStatus?:
    | "created"
    | "in_progress"
    | "succeeded"
    | "failed"
    | "pending"
    | "requires_action"
    | "expired"
    | "rejected";
  payload: unknown;
  /** `checkout_session.expired` fired before any payment was ever attempted, so there is no payment intent to inspect. */
  sessionExpiredWithoutPayment?: boolean;
  type: string;
}>;

export type ProcessFintocWebhookEventParams<TContext> = Readonly<{
  event: FintocWebhookEvent;
  fintocPaymentRepository: FintocPaymentRepository;
  holdRepository: HoldRepository<TContext>;
  reservationRepository: ReservationRepository<TContext>;
  roomLockGateway: RoomLockGateway<TContext>;
}>;

export type ProcessFintocWebhookEventResult =
  | Readonly<{ outcome: "ignored_duplicate" }>
  | Readonly<{ outcome: "payment_not_found" }>
  | Readonly<{ outcome: "reservation_confirmed" }>
  | Readonly<{ outcome: "hold_expired" }>
  | Readonly<{ outcome: "payment_failed" }>
  | Readonly<{ outcome: "requires_action" }>
  | Readonly<{ outcome: "no_action" }>;

/**
 * Dispatches one already signature-verified Fintoc webhook event (see
 * `verifyFintocWebhookSignature`). The caller must have already recorded
 * the event id for idempotency via `fintocPaymentRepository.recordWebhookEvent`
 * before calling this — this function assumes the event is new.
 */
export async function processFintocWebhookEvent<TContext>(
  params: ProcessFintocWebhookEventParams<TContext>
): Promise<ProcessFintocWebhookEventResult> {
  const {
    event,
    fintocPaymentRepository,
    holdRepository,
    reservationRepository,
    roomLockGateway,
  } = params;

  const payment = event.checkoutSessionId
    ? await fintocPaymentRepository.getPaymentByExternalReference(
        event.checkoutSessionId
      )
    : event.paymentIntentId
      ? await fintocPaymentRepository.getPaymentByProviderPaymentId(
          event.paymentIntentId
        )
      : null;
  if (!payment || !payment.holdId) {
    return Object.freeze({ outcome: "payment_not_found" });
  }
  // Already in a final state (a retried/duplicate event that slipped past
  // event-id idempotency, e.g. a redelivery with a new event id).
  if (payment.status !== "pending" && payment.status !== "requires_action") {
    return Object.freeze({ outcome: "ignored_duplicate" });
  }

  const hold = await holdRepository.getHoldById(payment.holdId);

  if (event.sessionExpiredWithoutPayment) {
    await fintocPaymentRepository.markFailed(payment, "cancelled");
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
          hold,
          holdRepository,
          paymentExternalReference: payment.externalReference,
          paymentId: payment.id,
          providerPaymentId: paymentIntentId,
          reservationRepository,
          roomLockGateway,
        });
        await fintocPaymentRepository.markApproved(payment, {
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
      await fintocPaymentRepository.markFailed(payment, status, paymentIntentId);
      if (hold) {
        await releaseFailedPayNowHold({ hold, holdRepository, roomLockGateway });
      }
      return Object.freeze({ outcome: "payment_failed" });
    }
    case "requires_action": {
      await fintocPaymentRepository.markRequiresAction(payment, paymentIntentId);
      return Object.freeze({ outcome: "requires_action" });
    }
    default:
      return Object.freeze({ outcome: "no_action" });
  }
}
