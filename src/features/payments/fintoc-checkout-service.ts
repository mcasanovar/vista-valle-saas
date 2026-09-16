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
  getMockFintocOnlinePaymentDependencies,
  getProductionFintocOnlinePaymentDependencies,
} from "./fintoc-dependencies";
import {
  FintocCheckoutUnavailableError,
  initiateFintocCheckout,
} from "./fintoc-checkout";

export class FintocCheckoutInputError extends Error {
  readonly code = "INVALID_FINTOC_CHECKOUT_INPUT" as const;
}

/**
 * Public entry point for the online-payment checkout, mirroring
 * `confirmPayAtPropertyBookingWith` in `@/features/reservations/confirm-pay-at-property.ts`:
 * rebuilds the request from untrusted values (resolving every selected
 * room the same way pay-at-property does — see
 * `add-mercado-pago-checkout-pro` design.md decision 3), then delegates
 * to `initiateFintocCheckout` for the hold + Fintoc session creation.
 * Supports one or more rooms under a single payment for the total (design.md decision 1).
 */
export async function initiatePublicFintocCheckout(
  candidate: Record<string, unknown>,
  roomSource?: RoomReadSource
) {
  const resolvedRoomSource = roomSource ?? (await getRoomReadSource());
  const selected = selectedRooms(candidate, resolvedRoomSource);
  if (
    !selected.length ||
    selected.length !== new Set(selected.map((entry) => entry.room.id)).size
  ) {
    throw new FintocCheckoutInputError(
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
        ? await initiateFintocCheckout({
            ...shared,
            ...getMockFintocOnlinePaymentDependencies(),
          })
        : await initiateFintocCheckout({
            ...shared,
            ...getProductionFintocOnlinePaymentDependencies(),
          });

    writeStructuredLog("info", "fintoc_checkout.initiated", {
      holdId: result.hold.id,
    });
    return result;
  } catch (error) {
    if (error instanceof RoomLockConflictError) throw error;
    if (error instanceof FintocCheckoutUnavailableError) throw error;
    if (error instanceof FintocCheckoutInputError) throw error;
    await captureServerException("fintoc_checkout.initiation_failed", error);
    throw new FintocCheckoutInputError(
      "Revisa las fechas y datos del huésped antes de continuar."
    );
  }
}
