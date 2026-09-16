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

import { createCanonicalMockFintocPaymentRepository } from "./fintoc-payment-repository";
import { getMercadoPagoClient } from "./mercado-pago-client";

/**
 * Every dependency the online-payment flow needs against the mock context
 * for Mercado Pago (mirrors `getMockFintocOnlinePaymentDependencies`).
 * Shares the same canonical mock hold/payment/reservation storage as
 * Fintoc — both providers write into the same `payments`-shaped table in
 * production, so the mock singletons mirror that.
 */
export function getMockMercadoPagoOnlinePaymentDependencies() {
  return {
    mercadoPagoClient: getMercadoPagoClient(),
    fintocPaymentRepository: createCanonicalMockFintocPaymentRepository(),
    guestRepository: mockGuestRepository,
    holdRepository: getCanonicalMockHoldRepository(),
    reservationRepository: mockReservationRepository,
    roomLockGateway: mockRoomLockGateway,
  };
}

/** Production counterpart of `getMockMercadoPagoOnlinePaymentDependencies`. */
export function getProductionMercadoPagoOnlinePaymentDependencies() {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    throw new Error(
      "getProductionMercadoPagoOnlinePaymentDependencies requires a production database boundary"
    );
  }
  const db = createProductionDatabase(boundary);
  return {
    mercadoPagoClient: getMercadoPagoClient(),
    fintocPaymentRepository: createDrizzleFintocPaymentRepository(db),
    guestRepository: createDrizzleGuestRepository(),
    holdRepository: createDrizzleHoldRepository(db),
    reservationRepository: createDrizzleReservationRepository(db),
    roomLockGateway: createDrizzleRoomLockGateway(db),
  };
}
