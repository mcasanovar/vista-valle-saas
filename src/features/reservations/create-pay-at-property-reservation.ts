import type { LodgingInterval, RoomLockGateway } from "@/features/availability";
import type { NotificationOutboxWriter } from "@/features/notifications";
import type { RoomReadModel } from "@/features/rooms";

import type { GuestRepository } from "./guest-repository";
import {
  computeMultiRoomReservationPricing,
  type ReservationCharge,
} from "./pricing";
import type {
  ExternalReservationPlatform,
  PayAtPropertyPayment,
  ReservationRecord,
  ReservationOrigin,
  ReservationRepository,
} from "./reservation-repository";
import { assertGuestCountWithinCapacity } from "./capacity";
import { parseGuestInput } from "./guest";

export type CreatePayAtPropertyReservationRoom = Pick<
  RoomReadModel,
  "capacity" | "id" | "nightlyPriceClp"
>;

export type CreatePayAtPropertyReservationParams<TContext> = Readonly<{
  actorUserId?: string;
  charges?: readonly ReservationCharge[];
  generatePublicId?: () => string;
  guestCandidate: unknown;
  guestRepository: GuestRepository<TContext>;
  interval: LodgingInterval;
  reservationRepository: ReservationRepository<TContext>;
  room: CreatePayAtPropertyReservationRoom;
  roomLockGateway: RoomLockGateway<TContext>;
  origin?: ReservationOrigin;
  notificationOutboxWriter?: NotificationOutboxWriter<TContext>;
  /** Channel-sync-only; see `CreateConfirmedPayAtPropertyReservationInput`. */
  paymentStatus?: "pending" | "approved";
  paymentProvider?: string;
  externalPlatform?: ExternalReservationPlatform;
  externalRef?: string;
}>;

export type CreateMultiRoomPayAtPropertyReservationParams<TContext> = Omit<
  CreatePayAtPropertyReservationParams<TContext>,
  "room" | "charges"
> &
  Readonly<{
    chargesByRoom?: ReadonlyMap<string, readonly ReservationCharge[]>;
    invoiceRequest?: unknown;
    rooms: readonly CreatePayAtPropertyReservationRoom[];
  }>;

export type ConfirmedPayAtPropertyReservation = Readonly<{
  /** `PendingPayAtPropertyPayment` unless `params.paymentStatus` is `"approved"` (channel-sync only). */
  payment: PayAtPropertyPayment;
  reservation: ReservationRecord;
}>;

/** Cryptographically random, externally visible reservation identifier. */
export function generateReservationPublicId() {
  return `VV-${crypto.randomUUID()}`;
}

const publicReservationIdPattern =
  /^VV-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isPublicReservationId(value: string) {
  return publicReservationIdPattern.test(value);
}

function normalizeInvoiceRequest(candidate: unknown) {
  if (candidate === undefined) return undefined;
  if (!candidate || typeof candidate !== "object")
    throw new Error("Invalid invoice request");
  const value = candidate as Record<string, unknown>;
  const fields = ["name", "rut", "phone", "businessActivity", "email"] as const;
  const normalized = Object.fromEntries(
    fields.map((field) => [field, String(value[field] ?? "").trim()])
  ) as Record<(typeof fields)[number], string>;
  if (fields.some((field) => !normalized[field]))
    throw new Error("Invoice request fields are required");
  if (!/^\S+@\S+\.\S+$/.test(normalized.email))
    throw new Error("Invalid invoice email");
  const compactRut = normalized.rut.replace(/[^0-9kK]/g, "").toUpperCase();
  const body = compactRut.slice(0, -1);
  const verifier = compactRut.slice(-1);
  let sum = 0;
  let multiplier = 2;
  for (const digit of [...body].reverse()) {
    sum += Number(digit) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }
  const expected = String(11 - (sum % 11))
    .replace("10", "K")
    .replace("11", "0");
  if (!/^\d{7,8}[0-9K]$/.test(compactRut) || verifier !== expected)
    throw new Error("Invalid Chilean RUT");
  return Object.freeze(normalized);
}

/**
 * The only MVP web booking command. It always produces a WEBSITE,
 * CONFIRMED, PAY_AT_PROPERTY reservation and a separate PENDING payment;
 * it intentionally has no client-controlled total, status, origin, or
 * payment-mode input, and cannot initiate PAY_NOW.
 */
export async function createPayAtPropertyReservation<TContext>(
  params: CreatePayAtPropertyReservationParams<TContext>
): Promise<ConfirmedPayAtPropertyReservation> {
  return createMultiRoomPayAtPropertyReservation({
    ...params,
    chargesByRoom: new Map([[params.room.id, params.charges ?? []]]),
    rooms: [params.room],
  });
}

/** Creates all selected room items, payment, and side effects under one stable multi-room lock. */
export async function createMultiRoomPayAtPropertyReservation<TContext>(
  params: CreateMultiRoomPayAtPropertyReservationParams<TContext>
): Promise<ConfirmedPayAtPropertyReservation> {
  const {
    chargesByRoom = new Map(),
    actorUserId,
    generatePublicId = generateReservationPublicId,
    guestCandidate,
    guestRepository,
    interval,
    reservationRepository,
    rooms,
    roomLockGateway,
    origin = "website",
    notificationOutboxWriter,
    paymentStatus,
    paymentProvider,
    externalPlatform,
    externalRef,
  } = params;
  const guest = parseGuestInput(guestCandidate);
  assertGuestCountWithinCapacity(
    guest.guestCount,
    rooms.reduce((capacity, room) => capacity + room.capacity, 0)
  );
  const pricing = computeMultiRoomReservationPricing(
    interval,
    rooms,
    chargesByRoom
  );
  const invoiceRequest = normalizeInvoiceRequest(params.invoiceRequest);

  return roomLockGateway.runExclusiveMany(
    rooms.map((room) => room.id),
    interval,
    async (context) => {
      const persistedGuest = await guestRepository.createGuest(context, guest);
      const created =
        await reservationRepository.createConfirmedPayAtPropertyReservation(
          context,
          {
            actorUserId,
            checkIn: interval.checkIn,
            checkOut: interval.checkOut,
            guestComment: guest.comment,
            guestCount: guest.guestCount,
            guestId: persistedGuest.id,
            items: pricing.items,
            invoiceRequest,
            publicId: generatePublicId(),
            origin,
            paymentStatus,
            paymentProvider,
            externalPlatform,
            externalRef,
          }
        );
      if (!notificationOutboxWriter) return created;

      try {
        await notificationOutboxWriter.writeReservationConfirmed(context, {
          guest: persistedGuest,
          payment: created.payment,
          reservation: created.reservation,
        });
        return created;
      } catch (error) {
        await reservationRepository.rollbackConfirmedPayAtPropertyReservation?.(
          context,
          created
        );
        await guestRepository.rollbackGuest?.(context, persistedGuest);
        throw error;
      }
    }
  );
}
