"use server";
import { revalidatePath } from "next/cache";

import {
  editReservationDates,
  ReservationDateEditRoomRateMissingError,
  ReservationNotFoundError,
} from "@/features/reservations";
import {
  InvalidLodgingIntervalError,
  RoomLockConflictError,
} from "@/features/availability";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleNotificationOutboxWriter } from "@/infrastructure/database/notification-outbox-repository";
import { createDrizzleReservationRepository } from "@/infrastructure/database/reservation-repository";
import { createDrizzleRoomLockGateway } from "@/infrastructure/database/room-lock";
import { queryProductionRooms } from "@/infrastructure/database/room-source";
import { createDatabaseBoundary } from "@/infrastructure/database/server";

export type EditReservationDatesActionResult =
  | Readonly<{ ok: true }>
  | Readonly<{
      code: "conflict" | "failure" | "validation";
      message: string;
      ok: false;
    }>;

/**
 * Typed core: edits a reservation's dates from already-validated values,
 * resolving production dependencies itself (design.md decision 1).
 * Re-validates eligibility, the interval, and room availability regardless
 * of what the caller already checked, and returns a typed result instead
 * of throwing.
 */
export async function editAdminReservationDatesWithResult(
  input: Readonly<{
    actorUserId: string;
    checkIn: string;
    checkOut: string;
    reservationId: string;
  }>
): Promise<EditReservationDatesActionResult> {
  if (!input.reservationId || !input.checkIn || !input.checkOut) {
    return Object.freeze({
      code: "validation" as const,
      message: "Completa la reserva y las nuevas fechas.",
      ok: false as const,
    });
  }

  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return Object.freeze({
      code: "failure" as const,
      message: "La edición de fechas solo está disponible en producción.",
      ok: false as const,
    });
  }
  const db = createProductionDatabase(boundary);
  const reservationRepository = createDrizzleReservationRepository(db);
  const roomLockGateway = createDrizzleRoomLockGateway(db);

  try {
    await editReservationDates({
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
  } catch (error) {
    if (error instanceof InvalidLodgingIntervalError) {
      return Object.freeze({
        code: "validation" as const,
        message: "La fecha de salida debe ser posterior a la de llegada.",
        ok: false as const,
      });
    }
    if (error instanceof RoomLockConflictError) {
      return Object.freeze({
        code: "conflict" as const,
        message:
          "Las nuevas fechas ya no están disponibles para una de las habitaciones.",
        ok: false as const,
      });
    }
    if (
      error instanceof ReservationNotFoundError ||
      error instanceof ReservationDateEditRoomRateMissingError
    ) {
      return Object.freeze({
        code: "failure" as const,
        message: "No encontramos la reserva o una de sus habitaciones.",
        ok: false as const,
      });
    }
    return Object.freeze({
      code: "failure" as const,
      message: "No pudimos actualizar las fechas.",
      ok: false as const,
    });
  }

  return Object.freeze({ ok: true as const });
}

/** Thin `FormData` adapter over `editAdminReservationDatesWithResult`. */
export async function editAdminReservationDatesAction(
  formData: FormData
): Promise<EditReservationDatesActionResult> {
  const session = await requireAdministrator();
  const id = String(formData.get("id") ?? "");
  const checkIn = String(formData.get("checkIn") ?? "");
  const checkOut = String(formData.get("checkOut") ?? "");

  const result = await editAdminReservationDatesWithResult({
    actorUserId: session.user.id,
    checkIn,
    checkOut,
    reservationId: id,
  });

  if (result.ok) {
    revalidatePath("/admin/reservas");
    revalidatePath(`/admin/reservas/${id}`);
    revalidatePath("/admin/calendario");
  }

  return result;
}
