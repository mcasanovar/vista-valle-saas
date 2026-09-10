import {
  createLodgingInterval,
  type MockRoomLockOperationContext,
} from "@/features/availability";

import type { ReservationItemPricingResult } from "./pricing";

export type ReservationStatus =
  | "cancelled"
  | "completed"
  | "confirmed"
  | "no_show";
export type ReservationOrigin =
  | "website"
  | "airbnb"
  | "booking"
  | "phone"
  | "whatsapp"
  | "admin";
/** Subset of `ReservationOrigin` that can operate an external channel-sync connection; mirrors the `channel` Drizzle enum. */
export type ExternalReservationPlatform = "airbnb" | "booking";

export type PayAtPropertyPayment = Readonly<{
  amountClp: number;
  currency: "CLP";
  externalReference: string;
  id: string;
  mode: "pay_at_property";
  /** `"pay_at_property"` for a guest-collected payment; the connection's platform (e.g. `"airbnb"`) for a channel-sync reservation whose payment was already approved by that platform (see `channel-calendar-sync` design.md decision 2). */
  provider: string;
  reservationId: string;
  status: "pending" | "approved";
}>;
export type PendingPayAtPropertyPayment = PayAtPropertyPayment &
  Readonly<{ status: "pending" }>;

/**
 * A payment approved through the online-payment flow (see
 * `@/features/payments/fintoc-payment-repository.ts` for the full status
 * lifecycle, which starts against a hold before the reservation exists).
 */
export type ApprovedPayNowPayment = Readonly<{
  amountClp: number;
  currency: "CLP";
  externalReference: string;
  id: string;
  mode: "pay_now";
  provider: string;
  providerPaymentId: string;
  reservationId: string;
  status: "approved";
}>;

export type ReservationRecord = Readonly<{
  chargesClp: number;
  checkIn: string;
  checkOut: string;
  createdAt: Date;
  guestComment?: string;
  guestCount: number;
  guestId: string;
  invoiceRequest?: InvoiceRequest;
  id: string;
  /** Frozen room lines. `roomId` and pricing fields below remain for legacy single-room consumers. */
  items: readonly ReservationItemRecord[];
  nightlyPriceClp: number;
  origin: ReservationOrigin;
  paymentMode: "pay_at_property" | "pay_now";
  publicId: string;
  roomId: string;
  status: ReservationStatus;
  totalClp: number;
  updatedAt: Date;
  /** Set only for a reservation created from an inbound channel-sync event; see `CreateConfirmedPayAtPropertyReservationInput`. */
  externalPlatform?: ExternalReservationPlatform;
  externalRef?: string;
}>;

export type ReservationItemRecord = Readonly<{
  chargesClp: number;
  guestCount: number;
  nightlyPriceClp: number;
  nights: number;
  roomId: string;
  subtotalClp: number;
}>;

export type InvoiceRequest = Readonly<{
  businessActivity: string;
  email: string;
  name: string;
  phone: string;
  rut: string;
}>;

export type CreateConfirmedPayAtPropertyReservationInput = Readonly<{
  /** Present only for an authenticated administrative creation audit. */
  actorUserId?: string;
  checkIn: string;
  checkOut: string;
  guestComment?: string;
  guestCount: number;
  guestId: string;
  items: readonly ReservationItemPricingResult[];
  invoiceRequest?: InvoiceRequest;
  origin?: ReservationOrigin;
  publicId: string;
  /**
   * Channel-sync-only fields (see `channel-calendar-sync` design.md
   * decisions 1-2). `paymentStatus`/`paymentProvider` default to the
   * existing "pending"/"pay_at_property" behavior when omitted, so every
   * caller outside channel sync is unaffected. `externalPlatform`/
   * `externalRef` identify the inbound event this reservation was created
   * from, for idempotent re-polling.
   */
  paymentStatus?: "pending" | "approved";
  paymentProvider?: string;
  externalPlatform?: ExternalReservationPlatform;
  externalRef?: string;
}>;

/**
 * Confirms a single-room reservation from an already-locked, already-priced
 * `reservation_holds` row (see `createPaymentHold` in `./create-hold.ts`)
 * once its Fintoc payment has succeeded. The implementation updates the
 * existing pending payment row (`paymentId`) in place rather than creating
 * a new one, so `payments.hold_id` and the newly-set `payments.reservation_id`
 * both point at this reservation.
 */
export type CreateConfirmedPayNowReservationInput = Readonly<{
  checkIn: string;
  checkOut: string;
  guestCount: number;
  guestId: string;
  item: ReservationItemPricingResult;
  paymentExternalReference: string;
  paymentId: string;
  providerPaymentId: string;
  publicId: string;
}>;

export type ReservationStateTransition = Readonly<{
  actorUserId?: string;
  reservationId: string;
  to: Exclude<ReservationStatus, "confirmed">;
}>;

export class ReservationStateTransitionError extends Error {
  readonly code = "INVALID_RESERVATION_STATE_TRANSITION" as const;

  constructor(from: ReservationStatus, to: ReservationStatus) {
    super(`Reservation cannot transition from ${from} to ${to}`);
    this.name = "ReservationStateTransitionError";
  }
}

export class ReservationNotFoundError extends Error {
  readonly code = "RESERVATION_NOT_FOUND" as const;

  constructor(reservationId: string) {
    super(`Reservation not found: ${reservationId}`);
    this.name = "ReservationNotFoundError";
  }
}

/**
 * Persisting a confirmed pay-at-property reservation also persists its
 * independent pending payment in the same room-lock transaction.
 * `createConfirmedPayNowReservation` is the online-payment counterpart: it
 * confirms a reservation from an already-existing hold and payment once
 * Fintoc reports the payment as succeeded (see
 * `@/features/payments/fintoc-checkout.ts`).
 */
export type ReservationRepository<TContext> = Readonly<{
  createConfirmedPayAtPropertyReservation: (
    context: TContext,
    input: CreateConfirmedPayAtPropertyReservationInput
  ) => Promise<
    Readonly<{
      /** `PendingPayAtPropertyPayment` unless `input.paymentStatus` is `"approved"` (channel-sync only; see design.md decision 2). */
      payment: PayAtPropertyPayment;
      reservation: ReservationRecord;
    }>
  >;
  createConfirmedPayNowReservation: (
    context: TContext,
    input: CreateConfirmedPayNowReservationInput
  ) => Promise<
    Readonly<{
      payment: ApprovedPayNowPayment;
      reservation: ReservationRecord;
    }>
  >;
  getReservationById: (id: string) => Promise<ReservationRecord | null>;
  listReservations?: () => Promise<readonly ReservationRecord[]>;
  getPendingPayAtPropertyPaymentByReservationId?: (
    reservationId: string
  ) => Promise<PendingPayAtPropertyPayment | null>;
  approvePayAtPropertyPayment?: (
    reservationId: string
  ) => Promise<PayAtPropertyPayment>;
  restorePendingPayAtPropertyPayment?: (
    reservationId: string
  ) => Promise<PendingPayAtPropertyPayment>;
  rollbackConfirmedPayAtPropertyReservation?: (
    context: TContext,
    created: Readonly<{
      payment: PayAtPropertyPayment;
      reservation: ReservationRecord;
    }>
  ) => Promise<void>;
  transitionReservationState: (
    context: TContext,
    transition: ReservationStateTransition
  ) => Promise<ReservationRecord>;
}>;

type MockReservationStorage = Readonly<{
  paymentsByReservationId: Map<string, PayAtPropertyPayment>;
  payNowPaymentsByReservationId: Map<string, ApprovedPayNowPayment>;
  publicIds: Set<string>;
  /** Keys are `${externalPlatform}:${externalRef}`; mirrors the `reservations_external_platform_ref_unique` DB constraint (task 1.2). */
  externalRefs: Set<string>;
  reservationsById: Map<string, ReservationRecord>;
}>;

const canonicalReservationStorageKey = Symbol.for(
  "vista-valle.mock.canonical-reservation-storage"
);

function createReservationStorage(): MockReservationStorage {
  return {
    paymentsByReservationId: new Map<string, PayAtPropertyPayment>(),
    payNowPaymentsByReservationId: new Map<string, ApprovedPayNowPayment>(),
    publicIds: new Set<string>(),
    externalRefs: new Set<string>(),
    reservationsById: new Map<string, ReservationRecord>(),
  };
}

function getCanonicalReservationStorage(): MockReservationStorage {
  const scope = globalThis as typeof globalThis & {
    [canonicalReservationStorageKey]?: MockReservationStorage;
  };
  return (scope[canonicalReservationStorageKey] ??= createReservationStorage());
}

function paymentReference(publicId: string) {
  return `pay-at-property:${publicId}`;
}

function assertConfirmedTransition(
  from: ReservationStatus,
  to: ReservationStateTransition["to"]
) {
  if (from !== "confirmed") {
    throw new ReservationStateTransitionError(from, to);
  }
}

/** In-memory transactional double used only by the explicit mock context. */
export function createMockReservationRepository(
  storage: MockReservationStorage = createReservationStorage()
): ReservationRepository<MockRoomLockOperationContext> {
  return Object.freeze({
    createConfirmedPayAtPropertyReservation: async (context, input) => {
      if (storage.publicIds.has(input.publicId)) {
        throw new Error("Reservation public identifier collision");
      }
      const externalKey =
        input.externalPlatform && input.externalRef
          ? `${input.externalPlatform}:${input.externalRef}`
          : undefined;
      if (externalKey && storage.externalRefs.has(externalKey)) {
        throw new Error(
          "Reservation external platform/reference collision"
        );
      }

      const createdAt = new Date();
      const items = Object.freeze(
        input.items.map((item) =>
          Object.freeze({
            chargesClp: item.chargesClp,
            guestCount: item.guestCount,
            nightlyPriceClp: item.nightlyPriceClp,
            nights: item.nights,
            roomId: item.roomId,
            subtotalClp: item.totalClp,
          })
        )
      );
      if (items.length === 0)
        throw new Error("Reservation requires room items");
      const firstItem = items[0]!;
      const reservation: ReservationRecord = Object.freeze({
        chargesClp: firstItem.chargesClp,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        createdAt,
        guestComment: input.guestComment,
        guestCount: input.guestCount,
        guestId: input.guestId,
        invoiceRequest: input.invoiceRequest,
        id: crypto.randomUUID(),
        nightlyPriceClp: firstItem.nightlyPriceClp,
        items,
        origin: input.origin ?? "website",
        paymentMode: "pay_at_property",
        publicId: input.publicId,
        roomId: firstItem.roomId,
        status: "confirmed",
        totalClp: items.reduce((total, item) => total + item.subtotalClp, 0),
        updatedAt: createdAt,
        externalPlatform: input.externalPlatform,
        externalRef: input.externalRef,
      });
      const payment: PayAtPropertyPayment = Object.freeze({
        amountClp: reservation.totalClp,
        currency: "CLP",
        externalReference: paymentReference(reservation.publicId),
        id: crypto.randomUUID(),
        mode: "pay_at_property",
        provider: input.paymentProvider ?? "pay_at_property",
        reservationId: reservation.id,
        status: input.paymentStatus ?? "pending",
      });

      storage.reservationsById.set(reservation.id, reservation);
      storage.paymentsByReservationId.set(reservation.id, payment);
      storage.publicIds.add(reservation.publicId);
      if (externalKey) storage.externalRefs.add(externalKey);
      for (const item of items)
        context.recordOccupancy({
          interval: createLodgingInterval(
            reservation.checkIn,
            reservation.checkOut
          ),
          roomId: item.roomId,
          source: "reservation",
          sourceId: reservation.id,
        });
      return Object.freeze({ payment, reservation });
    },
    createConfirmedPayNowReservation: async (context, input) => {
      if (storage.publicIds.has(input.publicId)) {
        throw new Error("Reservation public identifier collision");
      }

      const createdAt = new Date();
      const item = Object.freeze({
        chargesClp: input.item.chargesClp,
        guestCount: input.item.guestCount,
        nightlyPriceClp: input.item.nightlyPriceClp,
        nights: input.item.nights,
        roomId: input.item.roomId,
        subtotalClp: input.item.totalClp,
      });
      const reservation: ReservationRecord = Object.freeze({
        chargesClp: item.chargesClp,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        createdAt,
        guestCount: input.guestCount,
        guestId: input.guestId,
        id: crypto.randomUUID(),
        nightlyPriceClp: item.nightlyPriceClp,
        items: [item],
        origin: "website",
        paymentMode: "pay_now",
        publicId: input.publicId,
        roomId: item.roomId,
        status: "confirmed",
        totalClp: item.subtotalClp,
        updatedAt: createdAt,
      });
      const payment: ApprovedPayNowPayment = Object.freeze({
        amountClp: reservation.totalClp,
        currency: "CLP",
        externalReference: input.paymentExternalReference,
        id: input.paymentId,
        mode: "pay_now",
        provider: "fintoc",
        providerPaymentId: input.providerPaymentId,
        reservationId: reservation.id,
        status: "approved",
      });

      storage.reservationsById.set(reservation.id, reservation);
      storage.payNowPaymentsByReservationId.set(reservation.id, payment);
      storage.publicIds.add(reservation.publicId);
      context.recordOccupancy({
        interval: createLodgingInterval(input.checkIn, input.checkOut),
        roomId: item.roomId,
        source: "reservation",
        sourceId: reservation.id,
      });
      return Object.freeze({ payment, reservation });
    },
    getReservationById: (id) =>
      Promise.resolve(storage.reservationsById.get(id) ?? null),
    listReservations: () =>
      Promise.resolve(Object.freeze([...storage.reservationsById.values()])),
    getPendingPayAtPropertyPaymentByReservationId: (reservationId) =>
      Promise.resolve(
        storage.paymentsByReservationId.get(reservationId)?.status === "pending"
          ? (storage.paymentsByReservationId.get(
              reservationId
            ) as PendingPayAtPropertyPayment)
          : null
      ),
    approvePayAtPropertyPayment: async (reservationId) => {
      const payment = storage.paymentsByReservationId.get(reservationId);
      if (!payment || payment.status !== "pending")
        throw new Error("Pending payment not found");
      const approved = Object.freeze({
        ...payment,
        status: "approved" as const,
      });
      storage.paymentsByReservationId.set(reservationId, approved);
      return approved;
    },
    restorePendingPayAtPropertyPayment: async (reservationId) => {
      const payment = storage.paymentsByReservationId.get(reservationId);
      if (!payment || payment.status !== "approved")
        throw new Error("Approved payment not found");
      const pending = Object.freeze({ ...payment, status: "pending" as const });
      storage.paymentsByReservationId.set(reservationId, pending);
      return pending;
    },
    rollbackConfirmedPayAtPropertyReservation: async (context, created) => {
      storage.reservationsById.delete(created.reservation.id);
      storage.paymentsByReservationId.delete(created.reservation.id);
      storage.publicIds.delete(created.reservation.publicId);
      for (const item of created.reservation.items)
        context.removeOccupancy(
          "reservation",
          created.reservation.id,
          item.roomId
        );
    },
    transitionReservationState: async (context, transition) => {
      const current = storage.reservationsById.get(transition.reservationId);
      if (!current)
        throw new ReservationNotFoundError(transition.reservationId);
      assertConfirmedTransition(current.status, transition.to);

      const updated: ReservationRecord = Object.freeze({
        ...current,
        status: transition.to,
        updatedAt: new Date(),
      });
      storage.reservationsById.set(updated.id, updated);
      for (const item of updated.items)
        context.removeOccupancy("reservation", updated.id, item.roomId);
      return updated;
    },
  });
}

/** Shared only by the explicit mock composition across Route Handler/page bundles. */
export function createCanonicalMockReservationRepository() {
  return createMockReservationRepository(getCanonicalReservationStorage());
}

export { assertConfirmedTransition, paymentReference };
