import "server-only";

import {
  createLodgingInterval,
  RoomLockConflictError,
} from "@/features/availability";
import { getServerEnvironment } from "@/config/server";
import { getRoomReadSource, type RoomReadSource } from "@/features/rooms";
import { parseGuestInput } from "@/features/reservations";
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

function selectedRoom(candidate: Record<string, unknown>, source: RoomReadSource) {
  // `rooms` (comma-separated, from the multi-room prebooking flow) must
  // resolve to exactly one room here — this checkout is single-room only.
  const key = String(candidate.rooms ?? candidate.room ?? "").split(",")[0] ?? "";
  return source
    .listActive()
    .find((room) => room.id === key || room.slug === key);
}

/**
 * Public entry point for the online-payment checkout, mirroring
 * `confirmPayAtPropertyBookingWith` in `@/features/reservations/confirm-pay-at-property.ts`:
 * rebuilds the request from untrusted values, then delegates to
 * `initiateFintocCheckout` for the hold + Fintoc session creation.
 * Single-room only (design.md non-goal for this change: multi-room online
 * payment is not required by the `fintoc-payment-integration` spec).
 */
export async function initiatePublicFintocCheckout(
  candidate: Record<string, unknown>,
  roomSource?: RoomReadSource
) {
  const resolvedRoomSource = roomSource ?? (await getRoomReadSource());
  const roomKeys = String(candidate.rooms ?? candidate.room ?? "")
    .split(",")
    .filter(Boolean);
  if (roomKeys.length > 1) {
    throw new FintocCheckoutInputError(
      "El pago en línea solo está disponible para una habitación a la vez."
    );
  }
  const room = selectedRoom(candidate, resolvedRoomSource);
  if (!room) {
    throw new FintocCheckoutInputError(
      "La habitación seleccionada ya no está disponible."
    );
  }

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
      room,
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
