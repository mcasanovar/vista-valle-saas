import "server-only";
import {
  createLodgingInterval,
  type MockRoomLockOperationContext,
  type RoomLockGateway,
} from "@/features/availability";
import { getRoomReadSource, type RoomReadSource } from "@/features/rooms";
import {
  createMultiRoomPayAtPropertyReservation,
  isExternalChannelOrigin,
  parseGuestInput,
  selectedRooms,
  toResolvedRoom,
  type GuestBookingInput,
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
import { parseNightlyRateAmount } from "./nightly-rate-amount";

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

export type ManualReservationRoomSelection = Readonly<{
  guestCount: number;
  roomId: string;
}>;

export type ManualReservationInvoiceInput = Readonly<{
  businessActivity: string;
  email: string;
  name: string;
  phone: string;
  rut: string;
}>;

/**
 * Typed shape for `createManualReservationWith`'s domain logic, independent
 * of the `FormData`/loose-record encoding the admin form and its server
 * action use. Callers with already-typed values (e.g. the assistant's
 * `crear_reserva` tool) build this directly instead of round-tripping
 * through strings.
 */
export type ManualReservationInput = Readonly<{
  checkIn: string;
  checkOut: string;
  guest: GuestBookingInput;
  invoice?: ManualReservationInvoiceInput;
  /**
   * Hand-set nightly values by `roomId`, accepted only when `origin` is
   * `airbnb` or `booking` (`reservation-rate-and-channel-editing` spec
   * "Sobrescritura al crear una reserva manual"). A room absent from the map
   * is priced from its current occupancy rate, exactly as before.
   */
  nightlyRates?: ReadonlyMap<string, number>;
  origin: ManualOrigin;
  rooms: readonly ManualReservationRoomSelection[];
}>;

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

/**
 * Typed core: creates a manual reservation from already-validated, typed
 * values. This is the function to call from anything other than the admin
 * form's `FormData` action — it never parses strings or reads a loose
 * record, so it can't diverge from what the form path validates.
 */
/** Thrown when a hand-set nightly value reaches the creation path with an unusable amount. */
export class InvalidManualNightlyRateError extends RangeError {
  readonly code = "INVALID_MANUAL_NIGHTLY_RATE" as const;
  readonly roomId: string;

  constructor(roomId: string) {
    super(
      `Nightly value for room ${roomId} must be a positive whole amount of CLP`
    );
    this.name = "InvalidManualNightlyRateError";
    this.roomId = roomId;
  }
}

/**
 * Overrides one resolved room's nightly value with the administrator's, when
 * the reservation's origin allows it. Silently ignores the map for any other
 * origin, so a submission carrying rates for a phone or admin reservation
 * cannot change its price; the amount itself is validated here so the DB
 * check `reservation_items_nightly_price_positive` is never the first line of
 * defence.
 */
function applyManualNightlyRate<
  TRoom extends Readonly<{ id: string; nightlyPriceClp: number }>,
>(room: TRoom, input: ManualReservationInput): TRoom {
  if (!input.nightlyRates || !isExternalChannelOrigin(input.origin))
    return room;
  const manual = input.nightlyRates.get(room.id);
  if (manual === undefined) return room;
  if (!Number.isSafeInteger(manual) || manual <= 0)
    throw new InvalidManualNightlyRateError(room.id);
  return Object.freeze({
    ...room,
    nightlyPriceClp: manual,
    nightlyPriceManual: true,
  });
}

export async function createManualReservationFromInput<TContext>(
  input: ManualReservationInput,
  actor: string,
  roomSource: RoomReadSource,
  dependencies: ManualReservationDependencies<TContext>
) {
  if (!actor.trim()) throw new Error("Administrator actor is required");
  if (!manualOrigins.includes(input.origin))
    throw new Error("Invalid manual origin");
  const selected = selectedRooms(
    { rooms: input.rooms.map((r) => `${r.roomId}:${r.guestCount}`).join(",") },
    roomSource
  );
  if (!selected.length) throw new Error("Unknown room");
  const rooms = selected
    .map(toResolvedRoom)
    .map((room) => applyManualNightlyRate(room, input));
  const interval = createLodgingInterval(input.checkIn, input.checkOut);
  const dateErrors = validateManualReservationDateRange(
    interval.checkIn,
    interval.checkOut
  );
  if (dateErrors.length) throw new ManualReservationDateRangeError(dateErrors);
  const result = await createMultiRoomPayAtPropertyReservation({
    actorUserId: actor,
    guestCandidate: input.guest,
    guestRepository: dependencies.guestRepository,
    interval,
    reservationRepository: dependencies.reservationRepository,
    rooms,
    roomLockGateway: dependencies.roomLockGateway,
    origin: input.origin,
    invoiceRequest: input.invoice,
    notificationOutboxWriter: dependencies.notificationOutboxWriter,
  });
  writeStructuredLog("info", "reservation.manual_confirmed", {
    paymentId: result.payment.id,
    reservationId: result.reservation.id,
    source: input.origin,
  });
  return Object.freeze({ ...result, actor, origin: input.origin });
}

/**
 * Reads the per-room nightly values out of a loose submission record. Each
 * room arrives as a `rate:<roomId>` key, mirroring the edit action's field
 * naming. An empty value means "use the room's rate" and is simply omitted; a
 * malformed amount is passed through so `applyManualNightlyRate` rejects it
 * rather than being silently dropped.
 */
function manualNightlyRatesOf(
  candidate: Record<string, unknown>
): ReadonlyMap<string, number> | undefined {
  const rates = new Map<string, number>();
  for (const [key, value] of Object.entries(candidate)) {
    if (!key.startsWith("rate:")) continue;
    const roomId = key.slice("rate:".length);
    const raw = String(value ?? "").trim();
    if (!roomId || raw === "") continue;
    rates.set(roomId, parseNightlyRateAmount(raw));
  }
  return rates.size > 0 ? rates : undefined;
}

/**
 * Adapter over `createManualReservationFromInput` for callers that still
 * hand over a loose, string-keyed record — the admin form's `FormData`
 * (via `createManualReservationAction`) is the only intended caller.
 */
export async function createManualReservationWith<TContext>(
  candidate: Record<string, unknown>,
  actor: string,
  roomSource: RoomReadSource,
  dependencies: ManualReservationDependencies<TContext>
) {
  const origin = candidate.origin;
  if (!manualOrigins.includes(origin as ManualOrigin))
    throw new Error("Invalid manual origin");
  const selected = selectedRooms(candidate, roomSource);
  if (!selected.length) throw new Error("Unknown room");
  const guest = parseGuestInput(candidate);
  const input: ManualReservationInput = {
    checkIn: String(candidate.checkIn ?? ""),
    checkOut: String(candidate.checkOut ?? ""),
    guest,
    invoice: requestedInvoice(candidate),
    nightlyRates: manualNightlyRatesOf(candidate),
    origin: origin as ManualOrigin,
    rooms: selected.map((entry) => ({
      guestCount: entry.guestCount,
      roomId: entry.room.id,
    })),
  };
  return createManualReservationFromInput(input, actor, roomSource, dependencies);
}

/**
 * Same dependency resolution as `createManualReservation`, for callers
 * that already have a typed `ManualReservationInput` (the assistant's
 * `crear_reserva` tool) instead of a loose candidate record.
 */
export async function createManualReservationFromInputResolved(
  input: ManualReservationInput,
  actor: string
) {
  const roomSource = await getRoomReadSource();
  const boundary = createDatabaseBoundary();
  if (boundary.context === "mock") {
    const notificationOutboxWriter =
      getNotificationOutboxWriter<MockRoomLockOperationContext>();
    if (!notificationOutboxWriter)
      throw new Error("Manual reservations unavailable");
    return createManualReservationFromInput(input, actor, roomSource, {
      guestRepository: mockGuestRepository,
      notificationOutboxWriter,
      reservationRepository: mockReservationRepository,
      roomLockGateway: mockRoomLockGateway,
    });
  }

  const db = createProductionDatabase(boundary);
  return createManualReservationFromInput<ProductionRoomLockTransaction>(
    input,
    actor,
    roomSource,
    {
      guestRepository: createDrizzleGuestRepository(db),
      notificationOutboxWriter: createDrizzleNotificationOutboxWriter(),
      reservationRepository: createDrizzleReservationRepository(db),
      roomLockGateway: createDrizzleRoomLockGateway(db),
    }
  );
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
      guestRepository: createDrizzleGuestRepository(db),
      notificationOutboxWriter: createDrizzleNotificationOutboxWriter(),
      reservationRepository: createDrizzleReservationRepository(db),
      roomLockGateway: createDrizzleRoomLockGateway(db),
    }
  );
}
