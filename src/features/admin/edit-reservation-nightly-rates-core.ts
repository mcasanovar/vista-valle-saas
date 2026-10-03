import {
  editReservationNightlyRates,
  InvalidNightlyRateError,
  ReservationNotExternalChannelError,
  ReservationNotFoundError,
  ReservationRoomNotInStayError,
  ReservationStayRoomRateMissingError,
  type ReservationNightlyRateOverride,
} from "@/features/reservations";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import { createDrizzleRoomLockGateway } from "@/infrastructure/database/room-lock";
import { queryProductionRooms } from "@/infrastructure/database/room-source";
import { createDatabaseBoundary } from "@/infrastructure/database/server";

/** Recalculated money the form reports back after a confirmed edit. */
export type EditReservationNightlyRatesFinancialSummary = Readonly<{
  overpaymentClp: number;
  pendingBalanceClp: number;
  totalClp: number;
}>;

export type EditReservationNightlyRatesActionResult =
  | Readonly<{
      financialSummary?: EditReservationNightlyRatesFinancialSummary;
      ok: true;
    }>
  | Readonly<{
      code: "failure" | "validation";
      message: string;
      ok: false;
    }>;

/**
 * Typed core: sets, changes or drops the hand-set nightly value of an
 * external-channel reservation's rooms from already-parsed values, resolving
 * production dependencies itself. Re-validates eligibility by origin and
 * every requested amount regardless of what the caller already checked, and
 * returns a typed result instead of throwing.
 *
 * The totals are never taken from the submission: only the per-room nightly
 * value is accepted, and the subtotal and total are derived from it.
 *
 * Lives outside any `"use server"` module (harden-admin-authentication,
 * task 2.1 — extended during implementation to this core, found with the
 * same unverified-export shape as the six originally audited): only
 * `editAdminReservationNightlyRatesAction`
 * (`./edit-reservation-nightly-rates-action.ts`) may call this after
 * `requireAdministrator()`.
 */
export async function editAdminReservationNightlyRatesWithResult(
  input: Readonly<{
    actorUserId: string;
    overrides: readonly ReservationNightlyRateOverride[];
    reservationId: string;
  }>
): Promise<EditReservationNightlyRatesActionResult> {
  if (!input.reservationId) {
    return Object.freeze({
      code: "validation" as const,
      message: "Completa la reserva que quieres editar.",
      ok: false as const,
    });
  }
  if (input.overrides.length === 0) {
    return Object.freeze({
      code: "validation" as const,
      message: "Indica al menos un valor por noche para actualizar.",
      ok: false as const,
    });
  }

  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return Object.freeze({
      code: "failure" as const,
      message:
        "La edición del valor por noche solo está disponible en producción.",
      ok: false as const,
    });
  }
  const db = createProductionDatabase(boundary);
  const reservationRepository = createDrizzleReservationRepository(db);
  const roomLockGateway = createDrizzleRoomLockGateway(db);

  let financialSummary:
    | EditReservationNightlyRatesFinancialSummary
    | undefined;
  try {
    const outcome = await editReservationNightlyRates({
      getRoomRates: async (roomIds) => {
        const rooms = await queryProductionRooms();
        return new Map(
          rooms
            .filter((room) => roomIds.includes(room.id))
            .map((room) => [room.id, room])
        );
      },
      input,
      reservationRepository,
      roomLockGateway,
    });
    financialSummary = Object.freeze({
      overpaymentClp: outcome.financialSummary.overpaymentClp,
      pendingBalanceClp: outcome.financialSummary.pendingBalanceClp,
      totalClp: outcome.reservation.totalClp,
    });
  } catch (error) {
    if (error instanceof InvalidNightlyRateError) {
      return Object.freeze({
        code: "validation" as const,
        message: "El valor por noche debe ser un monto entero mayor que cero.",
        ok: false as const,
      });
    }
    if (error instanceof ReservationNotExternalChannelError) {
      return Object.freeze({
        code: "validation" as const,
        message:
          "Solo las reservas de Airbnb y Booking admiten un valor por noche propio.",
        ok: false as const,
      });
    }
    if (error instanceof ReservationRoomNotInStayError) {
      return Object.freeze({
        code: "validation" as const,
        message: "Una de las habitaciones no pertenece a esta reserva.",
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
      message: "No pudimos actualizar el valor por noche.",
      ok: false as const,
    });
  }

  return Object.freeze({ financialSummary, ok: true as const });
}
