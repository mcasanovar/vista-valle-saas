import "server-only";

import {
  createLodgingInterval,
  RoomLockConflictError,
} from "@/features/availability";
import { getServerEnvironment } from "@/config/server";
import { getRoomReadSource, type RoomReadSource } from "@/features/rooms";
import {
  parseGuestInput,
  selectedRooms,
  toResolvedRoom,
} from "@/features/reservations";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import {
  captureServerException,
  writeStructuredLog,
} from "@/infrastructure/observability/sentry";

import {
  getMockMercadoPagoOnlinePaymentDependencies,
  getProductionMercadoPagoOnlinePaymentDependencies,
} from "./mercado-pago-dependencies";
import {
  initiateMercadoPagoCheckout,
  MercadoPagoCheckoutUnavailableError,
} from "./mercado-pago-checkout";

export class MercadoPagoCheckoutInputError extends Error {
  readonly code = "INVALID_MERCADO_PAGO_CHECKOUT_INPUT" as const;
}

/**
 * Public entry point for the card-payment checkout, mirroring
 * `initiatePublicFintocCheckout` — same allow-listed input
 * (`publicOnlineCheckoutCandidate`), same room resolution
 * (`selectedRooms`/`toResolvedRoom`), same single-payment-for-the-total
 * behavior for one or more rooms.
 */
export async function initiatePublicMercadoPagoCheckout(
  candidate: Record<string, unknown>,
  roomSource?: RoomReadSource
) {
  const resolvedRoomSource = roomSource ?? (await getRoomReadSource());
  const selected = selectedRooms(candidate, resolvedRoomSource);
  if (
    !selected.length ||
    selected.length !== new Set(selected.map((entry) => entry.room.id)).size
  ) {
    throw new MercadoPagoCheckoutInputError(
      "La habitación seleccionada ya no está disponible."
    );
  }
  const rooms = selected.map(toResolvedRoom);

  try {
    const interval = createLodgingInterval(
      String(candidate.checkIn ?? ""),
      String(candidate.checkOut ?? "")
    );
    const guest = parseGuestInput(candidate);
    const environment = getServerEnvironment();
    const boundary = createDatabaseBoundary();
    const shared = {
      cancelUrl: `${environment.SITE_URL}/reservar/cancelado`,
      customerEmail: guest.email,
      guestCandidate: candidate,
      holdDurationMinutes: environment.BOOKING_HOLD_DURATION_MINUTES,
      interval,
      rooms,
      successUrl: `${environment.SITE_URL}/reservar/procesando`,
    } as const;

    const result =
      boundary.context !== "production"
        ? await initiateMercadoPagoCheckout({
            ...shared,
            ...getMockMercadoPagoOnlinePaymentDependencies(),
          })
        : await initiateMercadoPagoCheckout({
            ...shared,
            ...getProductionMercadoPagoOnlinePaymentDependencies(),
          });

    writeStructuredLog("info", "mercado_pago_checkout.initiated", {
      holdId: result.hold.id,
    });
    return result;
  } catch (error) {
    if (error instanceof RoomLockConflictError) throw error;
    if (error instanceof MercadoPagoCheckoutUnavailableError) throw error;
    if (error instanceof MercadoPagoCheckoutInputError) throw error;
    await captureServerException(
      "mercado_pago_checkout.initiation_failed",
      error
    );
    throw new MercadoPagoCheckoutInputError(
      "Revisa las fechas y datos del huésped antes de continuar."
    );
  }
}
