import "server-only";

import {
  createLodgingInterval,
  createMockRoomLockGateway,
  nights,
  RoomLockConflictError,
  type MockRoomLockOperationContext,
  type RoomLockGateway,
} from "@/features/availability";
import { getServerEnvironment } from "@/config/server";
import { getRoomReadSource, type RoomReadSource } from "@/features/rooms";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import {
  createDrizzleRoomLockGateway,
  type ProductionRoomLockTransaction,
} from "@/infrastructure/database/room-lock";
import { createDrizzleGuestRepository } from "@/infrastructure/database/guest-repository";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import { getProductionPublicBookingConfirmation } from "@/infrastructure/database/booking-confirmation-source";

import {
  createMultiRoomPayAtPropertyReservation,
  isPublicReservationId,
} from "./create-pay-at-property-reservation";
import {
  createCanonicalMockGuestRepository,
  type GuestRepository,
} from "./guest-repository";
import { parseGuestInput } from "./guest";
import {
  createCanonicalMockReservationRepository,
  type ReservationRepository,
} from "./reservation-repository";
import {
  assertBookingIdempotencyKey,
  createMockBookingIdempotencyStore,
  type BookingIdempotencyStore,
} from "./booking-idempotency";
import { bookingConfirmationFingerprint } from "./booking-confirmation-candidate";
import { createWebsiteChannelSyncTasks } from "@/features/channel-sync";
import {
  getNotificationOutboxWriter,
  type NotificationOutboxWriter,
} from "@/features/notifications";
import {
  captureServerException,
  writeStructuredLog,
} from "@/infrastructure/observability/sentry";

export type PublicBookingConfirmation = Readonly<{
  checkIn: string;
  checkOut: string;
  guest: Readonly<{ firstName: string }>;
  guestCount: number;
  nights: number;
  paymentMode: "PAY_AT_PROPERTY" | "PAY_NOW";
  publicId: string;
  room: Readonly<{ name: string }>;
  totalClp: number;
}>;

export class BookingConfirmationInputError extends Error {
  readonly code = "INVALID_BOOKING_CONFIRMATION" as const;
}

/** A deliberately generic error for an unavailable committing data source. */
export class BookingConfirmationUnavailableError extends Error {
  readonly code = "BOOKING_CONFIRMATION_UNAVAILABLE" as const;
}

/**
 * The operational kill switch (`BOOKING_ENABLED`, defaulting to enabled)
 * only pauses real bookings under `production`. Mock is always a sandbox -
 * a test or local dev session must never have its booking flow silently
 * paused by an unrelated environment value (see
 * `.env.test.example`/`scripts/with-test-env.mjs`, which pin
 * `VISTA_VALLE_CONFIG_CONTEXT=mock` for every automated test run).
 */
export function isBookingAcceptanceEnabled(): boolean {
  return (
    createDatabaseBoundary().context !== "production" ||
    getServerEnvironment().BOOKING_ENABLED
  );
}

export const mockRoomLockGateway = createMockRoomLockGateway();
export const mockGuestRepository =
  createCanonicalMockGuestRepository<MockRoomLockOperationContext>();
export const mockReservationRepository =
  createCanonicalMockReservationRepository();
const mockIdempotencyStore =
  createMockBookingIdempotencyStore<PublicBookingConfirmation>();

export async function getMockPendingPaymentByReservationId(id: string) {
  const reservation = await mockReservationRepository.getReservationById(id);
  const payment =
    await mockReservationRepository.getPendingPayAtPropertyPaymentByReservationId?.(
      id
    );
  return reservation && payment
    ? Object.freeze({ reservation, payment })
    : null;
}

export async function approveMockPayAtPropertyPaymentByReservationId(
  id: string
) {
  if (!mockReservationRepository.approvePayAtPropertyPayment) return null;
  return mockReservationRepository.approvePayAtPropertyPayment(id);
}

export async function getMockReservationPaymentAdminView(id: string) {
  const reservation = await mockReservationRepository.getReservationById(id);
  if (!reservation) return null;
  const pending =
    await mockReservationRepository.getPendingPayAtPropertyPaymentByReservationId?.(
      id
    );
  return Object.freeze({
    id: reservation.id,
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    roomId: reservation.roomId,
    roomIds: Object.freeze(reservation.items.map((item) => item.roomId)),
    origin: reservation.origin,
    status: reservation.status,
    totalClp: reservation.totalClp,
    paymentStatus: pending ? "pending" : "approved",
  });
}

export async function getMockReservationPaymentAdminViewByPublicId(
  publicId: string
) {
  const reservations = await mockReservationRepository.listReservations?.();
  const reservation = reservations?.find((item) => item.publicId === publicId);
  return reservation
    ? getMockReservationPaymentAdminView(reservation.id)
    : null;
}

export async function listMockReservationPaymentAdminViews() {
  const reservations = await mockReservationRepository.listReservations?.();
  return Promise.all(
    (reservations ?? []).map((reservation) =>
      getMockReservationPaymentAdminView(reservation.id)
    )
  ).then((views) =>
    views.filter((view): view is NonNullable<typeof view> => Boolean(view))
  );
}

function selectedRooms(
  candidate: Record<string, unknown>,
  source: RoomReadSource
) {
  const keys = String(candidate.rooms ?? candidate.room ?? "")
    .split(",")
    .filter(Boolean);
  return keys
    .map((key) =>
      source.listActive().find((room) => room.id === key || room.slug === key)
    )
    .filter((room): room is NonNullable<typeof room> => Boolean(room));
}

export type PayAtPropertyBookingDependencies<TContext> = Readonly<{
  guestRepository: GuestRepository<TContext>;
  reservationRepository: ReservationRepository<TContext>;
  roomLockGateway: RoomLockGateway<TContext>;
  /** Optional: a missing writer skips notifications rather than failing the booking (see `createMultiRoomPayAtPropertyReservation`). */
  notificationOutboxWriter?: NotificationOutboxWriter<TContext> | null;
}>;

/**
 * Rebuilds the complete booking from untrusted request values and commits it
 * through the one PAY_AT_PROPERTY command, against whichever repositories
 * `dependencies` provides (mock or Drizzle/production - see
 * `confirmPayAtPropertyBooking` and `getPayAtPropertyBookingConfirmationService`).
 * Browser-supplied totals, prices, statuses and payment modes are
 * intentionally absent from this contract.
 */
async function confirmPayAtPropertyBookingWith<TContext>(
  candidate: Record<string, unknown>,
  roomSource: RoomReadSource,
  dependencies: PayAtPropertyBookingDependencies<TContext>
): Promise<PublicBookingConfirmation> {
  const rooms = selectedRooms(candidate, roomSource);
  if (
    !rooms.length ||
    rooms.length !== new Set(rooms.map((room) => room.id)).size
  ) {
    throw new BookingConfirmationInputError(
      "La habitación seleccionada ya no está disponible."
    );
  }

  try {
    const interval = createLodgingInterval(
      String(candidate.checkIn ?? ""),
      String(candidate.checkOut ?? "")
    );
    // Parse here to obtain the deliberately minimal public guest representation.
    // `createPayAtPropertyReservation` parses it again as its authoritative
    // command boundary before it locks and persists anything.
    const guest = parseGuestInput(candidate);
    const invoiceRequest =
      candidate.invoiceRequested === "true"
        ? {
            name: String(candidate.invoiceName ?? ""),
            rut: String(candidate.invoiceRut ?? ""),
            phone: String(candidate.invoicePhone ?? ""),
            businessActivity: String(candidate.invoiceBusinessActivity ?? ""),
            email: String(candidate.invoiceEmail ?? ""),
          }
        : undefined;
    const created = await createMultiRoomPayAtPropertyReservation({
      guestCandidate: candidate,
      guestRepository: dependencies.guestRepository,
      interval,
      reservationRepository: dependencies.reservationRepository,
      rooms,
      roomLockGateway: dependencies.roomLockGateway,
      notificationOutboxWriter: dependencies.notificationOutboxWriter ?? undefined,
      invoiceRequest,
    });
    const confirmation: PublicBookingConfirmation = Object.freeze({
      checkIn: created.reservation.checkIn,
      checkOut: created.reservation.checkOut,
      guest: Object.freeze({ firstName: guest.firstName }),
      guestCount: created.reservation.guestCount,
      nights: nights(created.reservation.checkIn, created.reservation.checkOut),
      paymentMode: "PAY_AT_PROPERTY",
      publicId: created.reservation.publicId,
      room: Object.freeze({ name: rooms[0]!.name }),
      totalClp: created.reservation.totalClp,
    });
    createWebsiteChannelSyncTasks(
      created.reservation.id,
      created.reservation.items.map((item) => item.roomId)
    );
    writeStructuredLog("info", "reservation.confirmed", {
      paymentId: created.payment.id,
      reservationId: created.reservation.id,
      source: created.reservation.origin,
    });
    return confirmation;
  } catch (error) {
    // Availability conflicts are a distinct, safe user outcome and must be
    // mapped by the HTTP boundary without exposing occupancy details.
    if (error instanceof RoomLockConflictError) throw error;
    if (error instanceof BookingConfirmationInputError) throw error;
    await captureServerException("reservation.confirmation_failed", error);
    throw new BookingConfirmationInputError(
      "Revisa las fechas y datos del huésped antes de confirmar."
    );
  }
}

/** Mock-backed booking confirmation; used directly under `VISTA_VALLE_CONFIG_CONTEXT=mock` and by tests. */
export async function confirmPayAtPropertyBooking(
  candidate: Record<string, unknown>,
  roomSource?: RoomReadSource
): Promise<PublicBookingConfirmation> {
  const resolvedRoomSource = roomSource ?? (await getRoomReadSource());
  return confirmPayAtPropertyBookingWith(candidate, resolvedRoomSource, {
    guestRepository: mockGuestRepository,
    reservationRepository: mockReservationRepository,
    roomLockGateway: mockRoomLockGateway,
    notificationOutboxWriter:
      getNotificationOutboxWriter<MockRoomLockOperationContext>(),
  });
}

export function createIdempotentPayAtPropertyBookingConfirmationService(
  store: BookingIdempotencyStore<PublicBookingConfirmation>,
  command: (
    candidate: Record<string, unknown>
  ) => Promise<PublicBookingConfirmation> = confirmPayAtPropertyBooking
) {
  return (candidate: Record<string, unknown>, idempotencyKey: string) =>
    store.execute(
      assertBookingIdempotencyKey(idempotencyKey),
      bookingConfirmationFingerprint(candidate),
      () => command(candidate)
    );
}

/**
 * The idempotency store is a single in-memory map for the life of this
 * process - correct for a single long-lived server (current deployment
 * target) but not across multiple serverless instances. Revisit with a
 * database-backed store before scaling past one instance (see design.md).
 */
export function getPayAtPropertyBookingConfirmationService() {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return createPayAtPropertyBookingConfirmationService("mock");
  }
  const db = createProductionDatabase(boundary);
  const roomLockGateway = createDrizzleRoomLockGateway(db);
  const guestRepository = createDrizzleGuestRepository();
  const reservationRepository = createDrizzleReservationRepository(db);
  return createIdempotentPayAtPropertyBookingConfirmationService(
    mockIdempotencyStore,
    async (candidate) =>
      confirmPayAtPropertyBookingWith(candidate, await getRoomReadSource(), {
        guestRepository,
        reservationRepository,
        roomLockGateway,
        notificationOutboxWriter:
          getNotificationOutboxWriter<ProductionRoomLockTransaction>(),
      })
  );
}

export function createPayAtPropertyBookingConfirmationService(
  context: "mock" | "production"
) {
  if (context !== "mock") {
    throw new BookingConfirmationUnavailableError(
      "Booking confirmation is unavailable"
    );
  }
  return createIdempotentPayAtPropertyBookingConfirmationService(
    mockIdempotencyStore
  );
}

export async function getPublicBookingConfirmation(publicId: string) {
  if (!isPublicReservationId(publicId)) return null;
  const boundary = createDatabaseBoundary();
  if (boundary.context === "production") {
    return getProductionPublicBookingConfirmation(
      createProductionDatabase(boundary),
      publicId
    );
  }
  const reservations = await mockReservationRepository.listReservations?.();
  const reservation = reservations?.find((item) => item.publicId === publicId);
  if (!reservation) return null;

  const guest = await mockGuestRepository.getGuestById(reservation.guestId);
  const activeRooms = (await getRoomReadSource()).listActive();
  const room = activeRooms.find((item) => item.id === reservation.roomId);
  if (!guest || !room) return null;

  return Object.freeze({
    checkIn: reservation.checkIn,
    checkOut: reservation.checkOut,
    guest: Object.freeze({ firstName: guest.firstName }),
    guestCount: reservation.guestCount,
    nights: nights(reservation.checkIn, reservation.checkOut),
    paymentMode:
      reservation.paymentMode === "pay_now"
        ? ("PAY_NOW" as const)
        : ("PAY_AT_PROPERTY" as const),
    publicId: reservation.publicId,
    room: Object.freeze({ name: room.name }),
    rooms: Object.freeze(
      reservation.items
        .map((reservedItem) =>
          activeRooms.find((item) => item.id === reservedItem.roomId)
        )
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map((item) => Object.freeze({ name: item.name }))
    ),
    totalClp: reservation.totalClp,
  });
}
