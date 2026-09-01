import "server-only";

import {
  getCanonicalMockHoldRepository,
  mockGuestRepository,
  mockReservationRepository,
  mockRoomLockGateway,
} from "@/features/reservations";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleRoomLockGateway } from "@/infrastructure/database/room-lock";
import { createDrizzleGuestRepository } from "@/infrastructure/database/guest-repository";
import { createDrizzleHoldRepository } from "@/infrastructure/database/hold-repository";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import { createDrizzleFintocPaymentRepository } from "@/infrastructure/database/fintoc-payment-repository";

import { getFintocClient } from "./fintoc-client";
import { createCanonicalMockFintocPaymentRepository } from "./fintoc-payment-repository";

/**
 * Every dependency the online-payment flow needs against the mock context
 * (mirrors `confirmPayAtPropertyBooking`'s mock wiring). Returned as one
 * fully mock-typed bag rather than mixed with the production bag (see
 * `getProductionFintocOnlinePaymentDependencies`) so every field's
 * `TContext` — `MockRoomLockOperationContext` here,
 * `ProductionRoomLockTransaction` there — stays internally consistent;
 * TypeScript cannot correlate that across a union of two different bags.
 */
export function getMockFintocOnlinePaymentDependencies() {
  return {
    fintocClient: getFintocClient(),
    fintocPaymentRepository: createCanonicalMockFintocPaymentRepository(),
    guestRepository: mockGuestRepository,
    holdRepository: getCanonicalMockHoldRepository(),
    reservationRepository: mockReservationRepository,
    roomLockGateway: mockRoomLockGateway,
  };
}

/** Production counterpart of `getMockFintocOnlinePaymentDependencies` (mirrors `getPayAtPropertyBookingConfirmationService`'s production branch). */
export function getProductionFintocOnlinePaymentDependencies() {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    throw new Error(
      "getProductionFintocOnlinePaymentDependencies requires a production database boundary"
    );
  }
  const db = createProductionDatabase(boundary);
  return {
    fintocClient: getFintocClient(),
    fintocPaymentRepository: createDrizzleFintocPaymentRepository(db),
    guestRepository: createDrizzleGuestRepository(),
    holdRepository: createDrizzleHoldRepository(db),
    reservationRepository: createDrizzleReservationRepository(db),
    roomLockGateway: createDrizzleRoomLockGateway(db),
  };
}
