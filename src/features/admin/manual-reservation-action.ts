"use server";

import {
  InvalidLodgingDateError,
  InvalidLodgingIntervalError,
  RoomLockConflictError,
} from "@/features/availability";
import {
  GuestCapacityExceededError,
  InvalidGuestInputError,
} from "@/features/reservations";
import { requireAdministrator } from "@/infrastructure/auth/authorization";

import {
  createManualReservation,
  ManualReservationDateRangeError,
} from "./manual-reservation";

export type ManualReservationActionField =
  | "checkIn"
  | "checkOut"
  | "email"
  | "firstName"
  | "guestCount"
  | "invoice"
  | "lastName"
  | "origin"
  | "phone"
  | "roomIds";

type ManualReservationActionFailure = Readonly<{
  code: "availability_conflict" | "unavailable" | "validation";
  fieldErrors: readonly Readonly<{
    field: ManualReservationActionField;
    message: string;
  }>[];
  message: string;
  ok: false;
}>;

type ManualReservationActionSuccess = Readonly<{
  origin: string;
  ok: true;
  reservationId: string;
}>;

export type ManualReservationActionResult =
  | ManualReservationActionFailure
  | ManualReservationActionSuccess;

function validationResult(
  fieldErrors: ManualReservationActionFailure["fieldErrors"] = []
): ManualReservationActionFailure {
  return Object.freeze({
    code: "validation",
    fieldErrors: Object.freeze(fieldErrors.map((fieldError) => Object.freeze(fieldError))),
    message: "Revisa los datos de la reserva antes de confirmarla.",
    ok: false,
  });
}

function unavailableResult(): ManualReservationActionFailure {
  return Object.freeze({
    code: "unavailable",
    fieldErrors: Object.freeze([]),
    message:
      "No pudimos crear la reserva en este momento. Inténtalo nuevamente.",
    ok: false,
  });
}

function resultForCreationError(error: unknown): ManualReservationActionFailure {
  if (error instanceof ManualReservationDateRangeError) {
    return validationResult(
      error.fieldErrors.map(({ field, message }) => ({ field, message }))
    );
  }

  if (error instanceof RoomLockConflictError) {
    return Object.freeze({
      code: "availability_conflict",
      fieldErrors: Object.freeze([
        Object.freeze({
          field: "roomIds" as const,
          message:
            "Una o más habitaciones ya no están disponibles para estas fechas.",
        }),
      ]),
      message:
        "La disponibilidad cambió antes de confirmar. Revisa las habitaciones y vuelve a intentarlo.",
      ok: false,
    });
  }

  if (error instanceof InvalidGuestInputError) {
    const knownFields = new Set<ManualReservationActionField>([
      "email",
      "firstName",
      "guestCount",
      "lastName",
      "phone",
    ]);
    return validationResult(
      error.issues
        .filter(
          (issue): issue is typeof issue & { field: ManualReservationActionField } =>
            knownFields.has(issue.field as ManualReservationActionField)
        )
        .map((issue) => ({ field: issue.field, message: issue.message }))
    );
  }

  if (error instanceof GuestCapacityExceededError) {
    return validationResult([
      {
        field: "guestCount",
        message:
          "La cantidad de huéspedes supera la capacidad de las habitaciones seleccionadas.",
      },
    ]);
  }

  if (
    error instanceof InvalidLodgingDateError ||
    error instanceof InvalidLodgingIntervalError
  ) {
    return validationResult([
      {
        field: "checkOut",
        message: "Indica una fecha de salida posterior a la entrada.",
      },
    ]);
  }

  // These input failures predate typed domain errors. Their text is only used
  // to select a fixed browser-safe message; it is never returned to the client.
  if (error instanceof Error && error.message === "Unknown room") {
    return validationResult([
      {
        field: "roomIds",
        message: "Selecciona habitaciones disponibles para estas fechas.",
      },
    ]);
  }
  if (error instanceof Error && error.message === "Invalid manual origin") {
    return validationResult([
      { field: "origin", message: "Selecciona un origen válido." },
    ]);
  }
  if (
    error instanceof Error &&
    [
      "Invalid invoice request",
      "Invoice request fields are required",
      "Invalid invoice email",
      "Invalid Chilean RUT",
    ].includes(error.message)
  ) {
    return validationResult([
      { field: "invoice", message: "Revisa los datos de facturación." },
    ]);
  }

  // Persistence, notification, and provider failures must not be exposed as
  // validation details or accidentally reported as a successful reservation.
  return unavailableResult();
}

export async function createManualReservationAction(formData: FormData) {
  const session = await requireAdministrator();
  const roomIds = formData.getAll("roomIds").map(String).filter(Boolean);
  try {
    const created = await createManualReservation(
      {
        ...Object.fromEntries(formData),
        roomIds: roomIds.length ? roomIds : undefined,
      },
      session.user.id
    );
    return Object.freeze({
      ok: true as const,
      origin: created.origin,
      reservationId: created.reservation.id,
    });
  } catch (error) {
    return resultForCreationError(error);
  }
}
