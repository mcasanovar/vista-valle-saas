import "server-only";
import {
  createLodgingInterval,
  type MockRoomLockOperationContext,
  type RoomLockGateway,
} from "@/features/availability";
import { getRoomReadSource, type RoomReadSource } from "@/features/rooms";
import {
  createMultiRoomPayAtPropertyReservation,
  type GuestRepository,
  type ReservationRepository,
} from "@/features/reservations";
import {
  mockGuestRepository,
  mockReservationRepository,
  mockRoomLockGateway,
} from "@/features/reservations";
import { getNotificationOutboxWriter } from "@/features/notifications";
import type { NotificationOutboxWriter } from "@/features/notifications";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleGuestRepository } from "@/infrastructure/database/guest-repository";
import { createDrizzleNotificationOutboxWriter } from "@/infrastructure/database/notification-outbox-repository";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import {
  createDrizzleRoomLockGateway,
  type ProductionRoomLockTransaction,
} from "@/infrastructure/database/room-lock";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import {
  manualOrigins,
  validateManualReservationDateRange,
  type ManualOrigin,
  type ManualReservationDateFieldError,
} from "./manual-reservation-contract";
import { writeStructuredLog } from "@/infrastructure/observability/sentry";

export {
  manualOrigins,
  type ManualOrigin,
} from "./manual-reservation-contract";

export class ManualReservationDateRangeError extends Error {
  readonly code = "INVALID_MANUAL_RESERVATION_DATE_RANGE" as const;
  readonly fieldErrors: readonly ManualReservationDateFieldError[];

  constructor(fieldErrors: readonly ManualReservationDateFieldError[]) {
    super(fieldErrors[0]?.message ?? "Fechas de reserva inválidas.");
    this.name = "ManualReservationDateRangeError";
    this.fieldErrors = fieldErrors;
  }
}

export type ManualReservationDependencies<TContext> = Readonly<{
  guestRepository: GuestRepository<TContext>;
  notificationOutboxWriter: NotificationOutboxWriter<TContext>;
  reservationRepository: ReservationRepository<TContext>;
  roomLockGateway: RoomLockGateway<TContext>;
}>;

function requestedRoomIds(candidate: Record<string, unknown>) {
  const requested = Array.isArray(candidate.roomIds)
    ? candidate.roomIds.map(String)
    : [String(candidate.room ?? "")];
  return requested.map((id) => id.trim()).filter(Boolean);
}

function requestedInvoice(candidate: Record<string, unknown>) {
  if (
    candidate.invoiceRequested !== "true" &&
    candidate.invoiceRequested !== true
  )
    return undefined;
  return {
    businessActivity: String(candidate.invoiceBusinessActivity ?? ""),
    email: String(candidate.invoiceEmail ?? ""),
    name: String(candidate.invoiceName ?? ""),
    phone: String(candidate.invoicePhone ?? ""),
    rut: String(candidate.invoiceRut ?? ""),
  };
}

export async function createManualReservationWith<TContext>(
  candidate: Record<string, unknown>,
  actor: string,
  roomSource: RoomReadSource,
  dependencies: ManualReservationDependencies<TContext>
) {
  if (!actor.trim()) throw new Error("Administrator actor is required");
  const origin = candidate.origin;
  if (!manualOrigins.includes(origin as ManualOrigin))
    throw new Error("Invalid manual origin");
  const roomIds = requestedRoomIds(candidate);
  const rooms = roomIds.map((id) =>
    roomSource.listActive().find((room) => room.id === id)
  );
  if (
    !rooms.length ||
    rooms.some((room) => !room) ||
    new Set(roomIds).size !== roomIds.length
  )
    throw new Error("Unknown room");
  const interval = createLodgingInterval(
    String(candidate.checkIn ?? ""),
    String(candidate.checkOut ?? "")
  );
  const dateErrors = validateManualReservationDateRange(
    interval.checkIn,
    interval.checkOut
  );
  if (dateErrors.length) throw new ManualReservationDateRangeError(dateErrors);
  const result = await createMultiRoomPayAtPropertyReservation({
    actorUserId: actor,
    guestCandidate: candidate,
    guestRepository: dependencies.guestRepository,
    interval,
    reservationRepository: dependencies.reservationRepository,
    rooms: rooms as NonNullable<(typeof rooms)[number]>[],
    roomLockGateway: dependencies.roomLockGateway,
    origin: origin as ManualOrigin,
    invoiceRequest: requestedInvoice(candidate),
    notificationOutboxWriter: dependencies.notificationOutboxWriter,
  });
  writeStructuredLog("info", "reservation.manual_confirmed", {
    paymentId: result.payment.id,
    reservationId: result.reservation.id,
    source: origin,
  });
  return Object.freeze({ ...result, actor, origin: origin as ManualOrigin });
}

/** Resolves only server-side, context-matched dependencies. */
export async function createManualReservation(
  candidate: Record<string, unknown>,
  actor: string
) {
  const roomSource = await getRoomReadSource();
  const boundary = createDatabaseBoundary();
  if (boundary.context === "mock") {
    const notificationOutboxWriter =
      getNotificationOutboxWriter<MockRoomLockOperationContext>();
    if (!notificationOutboxWriter)
      throw new Error("Manual reservations unavailable");
    return createManualReservationWith(candidate, actor, roomSource, {
      guestRepository: mockGuestRepository,
      notificationOutboxWriter,
      reservationRepository: mockReservationRepository,
      roomLockGateway: mockRoomLockGateway,
    });
  }

  const db = createProductionDatabase(boundary);
  return createManualReservationWith<ProductionRoomLockTransaction>(
    candidate,
    actor,
    roomSource,
    {
      guestRepository: createDrizzleGuestRepository(),
      notificationOutboxWriter: createDrizzleNotificationOutboxWriter(),
      reservationRepository: createDrizzleReservationRepository(db),
      roomLockGateway: createDrizzleRoomLockGateway(db),
    }
  );
}
