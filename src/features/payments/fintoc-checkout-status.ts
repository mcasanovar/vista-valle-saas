import "server-only";

import { createDatabaseBoundary } from "@/infrastructure/database/server";

import {
  getMockFintocOnlinePaymentDependencies,
  getProductionFintocOnlinePaymentDependencies,
} from "./fintoc-dependencies";

export type FintocCheckoutStatus =
  | Readonly<{ status: "not_found" }>
  | Readonly<{ status: "processing" }>
  | Readonly<{ status: "confirmed"; publicId: string }>
  | Readonly<{ status: "failed" }>;

/**
 * Polled by `/reservar/procesando` after Fintoc redirects the guest back:
 * the webhook may not have processed yet, so the page needs to ask "is it
 * done, and if so, what reservation is it" separately from the redirect
 * itself (see `initiateFintocCheckout`'s `payment` query param).
 */
export async function getFintocCheckoutStatus(
  paymentId: string
): Promise<FintocCheckoutStatus> {
  const boundary = createDatabaseBoundary();
  const dependencies =
    boundary.context !== "production"
      ? getMockFintocOnlinePaymentDependencies()
      : getProductionFintocOnlinePaymentDependencies();

  const payment = await dependencies.fintocPaymentRepository.getPaymentById(
    paymentId
  );
  if (!payment) return { status: "not_found" };

  switch (payment.status) {
    case "pending":
    case "requires_action":
      return { status: "processing" };
    case "rejected":
    case "cancelled":
      return { status: "failed" };
    case "approved":
    case "refunded": {
      if (!payment.reservationId) return { status: "processing" };
      const reservation = await dependencies.reservationRepository.getReservationById(
        payment.reservationId
      );
      return reservation
        ? { status: "confirmed", publicId: reservation.publicId }
        : { status: "processing" };
    }
    default:
      return { status: "processing" };
  }
}
