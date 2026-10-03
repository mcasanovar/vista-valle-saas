import {
  editReservationOrigin,
  InvalidReservationOriginError,
  parseReservationOrigin,
  ReservationNotFoundError,
  ReservationStayRoomRateMissingError,
} from "@/features/reservations";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import { createDrizzleRoomLockGateway } from "@/infrastructure/database/room-lock";
import { queryProductionRooms } from "@/infrastructure/database/room-source";
import { createDatabaseBoundary } from "@/infrastructure/database/server";

/** Reported back only when the correction dropped hand-set values and repriced the stay. */
export type EditReservationOriginFinancialSummary = Readonly<{
  overpaymentClp: number;
  pendingBalanceClp: number;
  totalClp: number;
}>;

export type EditReservationOriginActionResult =
  | Readonly<{
      financialSummary?: EditReservationOriginFinancialSummary;
      ok: true;
    }>
  | Readonly<{
      code: "failure" | "validation";
      message: string;
      ok: false;
    }>;

/**
 * Typed core: corrects which origin a reservation is attributed to, resolving
 * production dependencies itself. Re-validates the requested origin, and when
 * the correction leaves an external channel behind, reprices the stay from the
 * rooms' current rates and reconciles payments in the same transaction.
 *
 * Lives outside any `"use server"` module (harden-admin-authentication,
 * task 2.1 — extended during implementation to this core, found with the
 * same unverified-export shape as the six originally audited): only
 * `editAdminReservationOriginAction` (`./edit-reservation-origin-action.ts`)
 * may call this after `requireAdministrator()`.
 */
export async function editAdminReservationOriginWithResult(
  input: Readonly<{
    actorUserId: string;
    origin: string;
    reservationId: string;
  }>
): Promise<EditReservationOriginActionResult> {
  if (!input.reservationId) {
    return Object.freeze({
      code: "validation" as const,
      message: "Completa la reserva que quieres editar.",
      ok: false as const,
    });
  }

  let origin;
  try {
    origin = parseReservationOrigin(input.origin);
  } catch {
    return Object.freeze({
      code: "validation" as const,
      message: "Selecciona un origen válido para la reserva.",
      ok: false as const,
    });
  }

  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return Object.freeze({
      code: "failure" as const,
      message: "La corrección de origen solo está disponible en producción.",
      ok: false as const,
    });
  }
  const db = createProductionDatabase(boundary);

  try {
    const outcome = await editReservationOrigin({
      // Supplied unconditionally: the use case decides whether repricing is
      // needed, and only reaches for these when it is.
      getRoomRates: async (roomIds) => {
        const rooms = await queryProductionRooms();
        return new Map(
          rooms
            .filter((room) => roomIds.includes(room.id))
            .map((room) => [room.id, room])
        );
      },
      input: {
        actorUserId: input.actorUserId,
        origin,
        reservationId: input.reservationId,
      },
      reservationRepository: createDrizzleReservationRepository(db),
      roomLockGateway: createDrizzleRoomLockGateway(db),
    });
    return Object.freeze({
      ...(outcome.financialSummary
        ? {
            financialSummary: Object.freeze({
              overpaymentClp: outcome.financialSummary.overpaymentClp,
              pendingBalanceClp: outcome.financialSummary.pendingBalanceClp,
              totalClp: outcome.reservation.totalClp,
            }),
          }
        : {}),
      ok: true as const,
    });
  } catch (error) {
    if (error instanceof InvalidReservationOriginError) {
      return Object.freeze({
        code: "validation" as const,
        message: "Selecciona un origen válido para la reserva.",
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
      message: "No pudimos corregir el origen.",
      ok: false as const,
    });
  }
}
