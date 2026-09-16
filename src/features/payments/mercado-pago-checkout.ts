import {
  type CreatePaymentHoldRoom,
  type GuestRepository,
  type HoldRepository,
  type ReservationHoldRecord,
} from "@/features/reservations";
import type { LodgingInterval, RoomLockGateway } from "@/features/availability";

import type { FintocPaymentRepository } from "./fintoc-payment-repository";
import type { MercadoPagoClient } from "./mercado-pago-client";
import { createMercadoPagoOnlinePaymentProvider } from "./mercado-pago-provider";
import {
  initiateOnlinePaymentCheckout,
  OnlinePaymentCheckoutUnavailableError,
} from "./online-payment-checkout";

/** Mercado Pago counterpart of `FintocCheckoutUnavailableError`. */
export class MercadoPagoCheckoutUnavailableError extends Error {
  readonly code = "MERCADO_PAGO_CHECKOUT_UNAVAILABLE" as const;
}

export type InitiateMercadoPagoCheckoutParams<TContext> = Readonly<{
  cancelUrl: string;
  customerEmail?: string;
  fintocPaymentRepository: FintocPaymentRepository;
  guestCandidate: unknown;
  guestRepository: GuestRepository<TContext>;
  holdDurationMinutes: number;
  holdRepository: HoldRepository<TContext>;
  interval: LodgingInterval;
  mercadoPagoClient: MercadoPagoClient;
  now?: () => Date;
  /** One or more distinct rooms; a single-room checkout passes an array of one. */
  rooms: readonly CreatePaymentHoldRoom[];
  roomLockGateway: RoomLockGateway<TContext>;
  successUrl: string;
}>;

export type InitiatedMercadoPagoCheckout = Readonly<{
  hold: ReservationHoldRecord;
  redirectUrl: string;
}>;

/**
 * Mercado Pago counterpart of `initiateFintocCheckout` — a thin wrapper
 * around the provider-agnostic `initiateOnlinePaymentCheckout`.
 */
export async function initiateMercadoPagoCheckout<TContext>(
  params: InitiateMercadoPagoCheckoutParams<TContext>
): Promise<InitiatedMercadoPagoCheckout> {
  const provider = createMercadoPagoOnlinePaymentProvider(
    params.mercadoPagoClient
  );
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
      throw new MercadoPagoCheckoutUnavailableError(
        "No se pudo iniciar el pago en línea con Mercado Pago"
      );
    }
    throw error;
  }
}
