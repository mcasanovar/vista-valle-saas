import {
  createPaymentHold,
  type CreatePaymentHoldRoom,
  type GuestRepository,
  type HoldRepository,
  type ReservationHoldRecord,
} from "@/features/reservations";
import type { LodgingInterval, RoomLockGateway } from "@/features/availability";

import { captureServerException } from "@/infrastructure/observability/sentry";

import type { FintocPaymentRepository } from "./fintoc-payment-repository";
import type { OnlinePaymentProvider } from "./online-payment-provider";

/** A deliberately generic error for an unavailable checkout-session creation, regardless of provider (see `BookingConfirmationUnavailableError`). */
export class OnlinePaymentCheckoutUnavailableError extends Error {
  readonly code = "ONLINE_PAYMENT_CHECKOUT_UNAVAILABLE" as const;
}

export type InitiateOnlinePaymentCheckoutParams<TContext> = Readonly<{
  cancelUrl: string;
  customerEmail?: string;
  guestCandidate: unknown;
  guestRepository: GuestRepository<TContext>;
  holdDurationMinutes: number;
  holdRepository: HoldRepository<TContext>;
  interval: LodgingInterval;
  now?: () => Date;
  /** Shared by every provider — `payments.provider` (a plain string column) is set from `provider.name`. */
  paymentRepository: FintocPaymentRepository;
  provider: OnlinePaymentProvider;
  /** One or more distinct rooms; a single-room checkout passes an array of one. */
  rooms: readonly CreatePaymentHoldRoom[];
  roomLockGateway: RoomLockGateway<TContext>;
  successUrl: string;
}>;

export type InitiatedOnlinePaymentCheckout = Readonly<{
  hold: ReservationHoldRecord;
  redirectUrl: string;
}>;

/**
 * Provider-agnostic core of the online-payment checkout flow (see
 * `add-mercado-pago-checkout-pro` design.md decision 2): retains every
 * selected room with a single hold (already generalized to N rooms —
 * design.md decision 1), then creates a checkout session with whichever
 * `provider` was injected, and persists a pending payment against the
 * hold before redirecting the guest. The hold creation and the provider's
 * API call are deliberately two separate steps — the room lock
 * transaction never stays open across the outbound HTTP request.
 *
 * `initiateFintocCheckout` (`./fintoc-checkout.ts`) is a thin wrapper
 * around this function for Fintoc, kept as its own name/shape for
 * backward compatibility with existing call sites and tests.
 */
export async function initiateOnlinePaymentCheckout<TContext>(
  params: InitiateOnlinePaymentCheckoutParams<TContext>
): Promise<InitiatedOnlinePaymentCheckout> {
  const hold = await createPaymentHold(params);
  // Generated here (before the provider's API call even exists) so it can
  // be embedded in success_url/cancel_url as the token the post-redirect
  // status page polls by (see `CreatePendingFintocPaymentInput.id`).
  const paymentId = crypto.randomUUID();

  try {
    const successUrl = new URL(params.successUrl);
    successUrl.searchParams.set("payment", paymentId);
    const cancelUrl = new URL(params.cancelUrl);
    cancelUrl.searchParams.set("payment", paymentId);

    const session = await params.provider.createCheckoutSession({
      amountClp: hold.totalClp,
      cancelUrl: cancelUrl.toString(),
      customerEmail: params.customerEmail,
      expiresAt: hold.expiresAt,
      externalReference: hold.id,
      successUrl: successUrl.toString(),
    });
    await params.paymentRepository.createPendingPayment({
      id: paymentId,
      amountClp: hold.totalClp,
      externalReference: session.externalReference,
      holdId: hold.id,
      provider: params.provider.name,
    });
    return Object.freeze({ hold, redirectUrl: session.redirectUrl });
  } catch (error) {
    // The hold is left in place: it simply expires via its existing TTL
    // (see `HoldRepository`/`isHoldExpired`) if the guest never retries.
    await captureServerException(
      `${params.provider.name}_checkout.session_creation_failed`,
      error,
      { holdId: hold.id }
    );
    throw new OnlinePaymentCheckoutUnavailableError(
      `No se pudo iniciar el pago en línea con ${params.provider.name}`
    );
  }
}
