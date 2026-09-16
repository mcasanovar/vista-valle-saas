import type {
  HoldRepository,
  ReservationRepository,
} from "@/features/reservations";
import type { RoomLockGateway } from "@/features/availability";

import type { FintocPaymentRepository } from "./fintoc-payment-repository";
import {
  processOnlinePaymentWebhookEvent,
  type ProcessOnlinePaymentWebhookEventResult,
} from "./online-payment-webhook";

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

export type ProcessFintocWebhookEventResult = Exclude<
  ProcessOnlinePaymentWebhookEventResult,
  Readonly<{ outcome: "charged_back" }>
>;

/**
 * Thin Fintoc-specific wrapper around the provider-agnostic
 * `processOnlinePaymentWebhookEvent` (`./online-payment-webhook.ts`),
 * kept as its own name/params for backward compatibility with existing
 * call sites and tests (see `add-mercado-pago-checkout-pro` design.md
 * decision 2). The caller must have already recorded the event id for
 * idempotency via `fintocPaymentRepository.recordWebhookEvent` before
 * calling this — this function assumes the event is new.
 */
export async function processFintocWebhookEvent<TContext>(
  params: ProcessFintocWebhookEventParams<TContext>
): Promise<ProcessFintocWebhookEventResult> {
  const result = await processOnlinePaymentWebhookEvent({
    event: {
      externalReference: params.event.checkoutSessionId,
      id: params.event.id,
      occurredAt: params.event.occurredAt,
      paymentIntentId: params.event.paymentIntentId,
      paymentIntentStatus: params.event.paymentIntentStatus,
      payload: params.event.payload,
      sessionExpiredWithoutPayment: params.event.sessionExpiredWithoutPayment,
      type: params.event.type,
    },
    paymentProvider: "fintoc",
    paymentRepository: params.fintocPaymentRepository,
    holdRepository: params.holdRepository,
    reservationRepository: params.reservationRepository,
    roomLockGateway: params.roomLockGateway,
  });
  // Fintoc never sends a chargeback event (it settles by bank transfer,
  // not card), so this outcome is unreachable here — narrowed away for
  // this wrapper's callers.
  return result as ProcessFintocWebhookEventResult;
}
