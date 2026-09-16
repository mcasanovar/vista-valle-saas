import {
  type CreatePaymentHoldRoom,
  type GuestRepository,
  type HoldRepository,
  type ReservationHoldRecord,
} from "@/features/reservations";
import type { LodgingInterval, RoomLockGateway } from "@/features/availability";

import type { FintocClient } from "./fintoc-client";
import type { FintocPaymentRepository } from "./fintoc-payment-repository";
import { createFintocOnlinePaymentProvider } from "./fintoc-provider";
import {
  initiateOnlinePaymentCheckout,
  OnlinePaymentCheckoutUnavailableError,
} from "./online-payment-checkout";

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
  /** One or more distinct rooms; a single-room checkout passes an array of one (see `add-mercado-pago-checkout-pro` design.md decision 1). */
  rooms: readonly CreatePaymentHoldRoom[];
  roomLockGateway: RoomLockGateway<TContext>;
  successUrl: string;
}>;

export type InitiatedFintocCheckout = Readonly<{
  hold: ReservationHoldRecord;
  redirectUrl: string;
}>;

/**
 * Thin Fintoc-specific wrapper around the provider-agnostic
 * `initiateOnlinePaymentCheckout` (`./online-payment-checkout.ts`), kept
 * as its own name/params for backward compatibility with existing call
 * sites and tests (see `add-mercado-pago-checkout-pro` design.md decision
 * 2). Implements the online-payment half of design.md decision 7 of
 * `build-vista-valle-booking-mvp`.
 */
export async function initiateFintocCheckout<TContext>(
  params: InitiateFintocCheckoutParams<TContext>
): Promise<InitiatedFintocCheckout> {
  const provider = createFintocOnlinePaymentProvider(params.fintocClient);
  try {
    return await initiateOnlinePaymentCheckout({
      cancelUrl: params.cancelUrl,
      customerEmail: params.customerEmail,
      guestCandidate: params.guestCandidate,
      guestRepository: params.guestRepository,
      holdDurationMinutes: params.holdDurationMinutes,
      holdRepository: params.holdRepository,
      interval: params.interval,
      now: params.now,
      paymentRepository: params.fintocPaymentRepository,
      provider,
      rooms: params.rooms,
      roomLockGateway: params.roomLockGateway,
      successUrl: params.successUrl,
    });
  } catch (error) {
    if (error instanceof OnlinePaymentCheckoutUnavailableError) {
      throw new FintocCheckoutUnavailableError(
        "No se pudo iniciar el pago en línea con Fintoc"
      );
    }
    throw error;
  }
}
