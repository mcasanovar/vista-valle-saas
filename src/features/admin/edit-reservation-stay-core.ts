import {
  editReservationStay,
  ReservationNotFoundError,
  ReservationStayRequiresRoomError,
  ReservationStayRoomCapacityExceededError,
  ReservationStayRoomRateMissingError,
} from "@/features/reservations";
import {
  InvalidLodgingIntervalError,
  RoomLockConflictError,
} from "@/features/availability";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleNotificationOutboxWriter } from "@/infrastructure/database/notification-outbox-repository";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import { createDrizzleRoomLockGateway } from "@/infrastructure/database/room-lock";
import { queryProductionRooms } from "@/infrastructure/database/room-source";
import { createDatabaseBoundary } from "@/infrastructure/database/server";

/** Recalculated money the form reports back after a confirmed edit. */
export type EditReservationStayFinancialSummary = Readonly<{
  overpaymentClp: number;
  pendingBalanceClp: number;
  totalClp: number;
}>;

export type EditReservationStayActionResult =
  | Readonly<{
      financialSummary?: EditReservationStayFinancialSummary;
      ok: true;
    }>
  | Readonly<{
      code: "conflict" | "failure" | "validation";
      message: string;
      ok: false;
    }>;

/**
 * Typed core: edits a reservation's stay - dates, rooms, and per-room
 * occupancy - from already-validated values, resolving production
 * dependencies itself. Re-validates eligibility, the interval, capacity
 * and room availability regardless of what the caller already checked,
 * and returns a typed result instead of throwing.
 *
 * `checkIn`/`checkOut` and `items` are each optional: omitting a pair
 * keeps what is persisted, so the dates-only caller
 * (`./edit-reservation-dates-core.ts`) reaches the same transaction.
 *
 * Lives outside any `"use server"` module (harden-admin-authentication,
 * task 2.1): only `editAdminReservationStayAction`
 * (`./edit-reservation-stay-action.ts`) and `editAdminReservationDatesWithResult`
 * (`./edit-reservation-dates-core.ts`, called directly by the assistant's
 * operation executor) may call this — both after `requireAdministrator()`.
 */
export async function editAdminReservationStayWithResult(
  input: Readonly<{
    actorUserId: string;
    checkIn?: string;
    checkOut?: string;
    items?: readonly Readonly<{ guestCount: number; roomId: string }>[];
    reservationId: string;
  }>
): Promise<EditReservationStayActionResult> {
  if (!input.reservationId) {
    return Object.freeze({
      code: "validation" as const,
      message: "Completa la reserva que quieres editar.",
      ok: false as const,
    });
  }
  // One date without the other cannot form an interval; both-absent is the
  // legitimate "keep the current dates" case.
  if (Boolean(input.checkIn) !== Boolean(input.checkOut)) {
    return Object.freeze({
      code: "validation" as const,
      message: "Completa las fechas de entrada y salida.",
      ok: false as const,
    });
  }
  if (input.items && input.items.length === 0) {
    return Object.freeze({
      code: "validation" as const,
      message: "La reserva debe conservar al menos una habitación.",
      ok: false as const,
    });
  }

  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return Object.freeze({
      code: "failure" as const,
      message: "La edición de estadía solo está disponible en producción.",
      ok: false as const,
    });
  }
  const db = createProductionDatabase(boundary);
  const reservationRepository = createDrizzleReservationRepository(db);
  const roomLockGateway = createDrizzleRoomLockGateway(db);

  let financialSummary: EditReservationStayFinancialSummary | undefined;
  try {
    const outcome = await editReservationStay({
      getRoomRates: async (roomIds) => {
        const rooms = await queryProductionRooms();
        return new Map(
          rooms
            .filter((room) => roomIds.includes(room.id))
            .map((room) => [room.id, room])
        );
      },
      input,
      notificationOutboxWriter: createDrizzleNotificationOutboxWriter(),
      reservationRepository,
      roomLockGateway,
    });
    financialSummary = outcome?.financialSummary
      ? Object.freeze({
          overpaymentClp: outcome.financialSummary.overpaymentClp,
          pendingBalanceClp: outcome.financialSummary.pendingBalanceClp,
          totalClp: outcome.reservation.totalClp,
        })
      : undefined;
  } catch (error) {
    if (error instanceof InvalidLodgingIntervalError) {
      return Object.freeze({
        code: "validation" as const,
        message: "La fecha de salida debe ser posterior a la de llegada.",
        ok: false as const,
      });
    }
    if (error instanceof ReservationStayRequiresRoomError) {
      return Object.freeze({
        code: "validation" as const,
        message: "La reserva debe conservar al menos una habitación.",
        ok: false as const,
      });
    }
    if (error instanceof ReservationStayRoomCapacityExceededError) {
      return Object.freeze({
        code: "validation" as const,
        message:
          "Una de las habitaciones no admite la cantidad de personas indicada.",
        ok: false as const,
      });
    }
    if (error instanceof RoomLockConflictError) {
      return Object.freeze({
        code: "conflict" as const,
        message:
          "La estadía solicitada ya no está disponible para una de las habitaciones.",
        ok: false as const,
      });
    }
    if (
      error instanceof ReservationNotFoundError ||
      error instanceof ReservationStayRoomRateMissingError
    ) {
      return Object.freeze({
        code: "failure" as const,
        message: "No encontramos la reserva o una de sus habitaciones.",
        ok: false as const,
      });
    }
    return Object.freeze({
      code: "failure" as const,
      message: "No pudimos actualizar la estadía.",
      ok: false as const,
    });
  }

  return Object.freeze({
    ...(financialSummary ? { financialSummary } : {}),
    ok: true as const,
  });
}
