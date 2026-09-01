import {
  createPaymentHold,
  type CreatePaymentHoldRoom,
  type GuestRepository,
  type HoldRepository,
  type ReservationHoldRecord,
} from "@/features/reservations";
import type { LodgingInterval, RoomLockGateway } from "@/features/availability";

import { captureServerException } from "@/infrastructure/observability/sentry";

import type { FintocClient } from "./fintoc-client";
import type { FintocPaymentRepository } from "./fintoc-payment-repository";

/** A deliberately generic error for an unavailable Fintoc checkout creation (see `BookingConfirmationUnavailableError`). */
export class FintocCheckoutUnavailableError extends Error {
  readonly code = "FINTOC_CHECKOUT_UNAVAILABLE" as const;
}

export type InitiateFintocCheckoutParams<TContext> = Readonly<{
  cancelUrl: string;
  customerEmail?: string;
  fintocClient: FintocClient;
  fintocPaymentRepository: FintocPaymentRepository;
  guestCandidate: unknown;
  guestRepository: GuestRepository<TContext>;
  holdDurationMinutes: number;
  holdRepository: HoldRepository<TContext>;
  interval: LodgingInterval;
  now?: () => Date;
  room: CreatePaymentHoldRoom;
  roomLockGateway: RoomLockGateway<TContext>;
  successUrl: string;
}>;

export type InitiatedFintocCheckout = Readonly<{
  hold: ReservationHoldRecord;
  redirectUrl: string;
}>;

/**
 * Implements the online-payment half of design.md decision 7 of
 * `build-vista-valle-booking-mvp`: retain the room with a hold (already
 * built), then create a Fintoc Checkout Session referencing it, and
 * persist a pending payment against the hold before redirecting the guest.
 * The hold creation and the Fintoc API call are deliberately two separate
 * steps — the room lock transaction never stays open across the outbound
 * HTTP request.
 */
export async function initiateFintocCheckout<TContext>(
  params: InitiateFintocCheckoutParams<TContext>
): Promise<InitiatedFintocCheckout> {
  const hold = await createPaymentHold(params);
  // Generated here (before the Fintoc API call even exists) so it can be
  // embedded in success_url/cancel_url as the token the post-redirect
  // status page polls by (see `CreatePendingFintocPaymentInput.id`).
  const paymentId = crypto.randomUUID();

  try {
    const successUrl = new URL(params.successUrl);
    successUrl.searchParams.set("payment", paymentId);
    const cancelUrl = new URL(params.cancelUrl);
    cancelUrl.searchParams.set("payment", paymentId);

    const session = await params.fintocClient.createCheckoutSession({
      amountClp: hold.totalClp,
      customerEmail: params.customerEmail,
      externalReference: hold.id,
      successUrl: successUrl.toString(),
      cancelUrl: cancelUrl.toString(),
    });
    await params.fintocPaymentRepository.createPendingPayment({
      id: paymentId,
      amountClp: hold.totalClp,
      externalReference: session.id,
      holdId: hold.id,
    });
    return Object.freeze({ hold, redirectUrl: session.redirectUrl });
  } catch (error) {
    // The hold is left in place: it simply expires via its existing TTL
    // (see `HoldRepository`/`isHoldExpired`) if the guest never retries.
    await captureServerException("fintoc_checkout.session_creation_failed", error, {
      holdId: hold.id,
    });
    throw new FintocCheckoutUnavailableError(
      "No se pudo iniciar el pago en línea con Fintoc"
    );
  }
}
