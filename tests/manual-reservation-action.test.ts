import { describe, expect, it, vi } from "vitest";

const { requireAdministrator } = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
}));
const { createManualReservation } = vi.hoisted(() => ({
  createManualReservation: vi.fn(),
}));
vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator,
}));
vi.mock("@/features/admin/manual-reservation", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/features/admin/manual-reservation")>()),
  createManualReservation,
}));

import { createManualReservationAction } from "@/features/admin/manual-reservation-action";
import { ManualReservationDateRangeError } from "@/features/admin/manual-reservation";
import { RoomLockConflictError } from "@/features/availability";
import { InvalidGuestInputError } from "@/features/reservations";

describe("manual reservation action", () => {
  it("requires an administrator before attempting creation", async () => {
    requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(createManualReservationAction(new FormData())).rejects.toThrow(
      "unauthorized"
    );
    expect(requireAdministrator).toHaveBeenCalledOnce();
    expect(createManualReservation).not.toHaveBeenCalled();
  });

  it("returns only the operational creation acknowledgement to the browser", async () => {
    requireAdministrator.mockResolvedValueOnce({ user: { id: "admin-1" } });
    createManualReservation.mockResolvedValueOnce({
      origin: "booking",
      payment: {
        externalReference: "must-not-leak",
        provider: "pay_at_property",
      },
      reservation: { id: "reservation-1" },
    });

    await expect(
      createManualReservationAction(new FormData())
    ).resolves.toEqual({
      ok: true,
      origin: "booking",
      reservationId: "reservation-1",
    });
  });

  it("returns a safe, actionable availability conflict without occupancy details", async () => {
    requireAdministrator.mockResolvedValueOnce({ user: { id: "admin-1" } });
    createManualReservation.mockRejectedValueOnce(new RoomLockConflictError([]));

    await expect(
      createManualReservationAction(new FormData())
    ).resolves.toEqual({
      code: "availability_conflict",
      fieldErrors: [
        {
          field: "roomIds",
          message:
            "Una o más habitaciones ya no están disponibles para estas fechas.",
        },
      ],
      message:
        "La disponibilidad cambió antes de confirmar. Revisa las habitaciones y vuelve a intentarlo.",
      ok: false,
    });
  });

  it("serializes only safe server validation field errors", async () => {
    requireAdministrator.mockResolvedValueOnce({ user: { id: "admin-1" } });
    createManualReservation.mockRejectedValueOnce(
      new InvalidGuestInputError([
        { field: "email", message: "Ingresa un correo electrónico válido." },
        { field: "internal", message: "must not reach the browser" },
      ])
    );

    await expect(
      createManualReservationAction(new FormData())
    ).resolves.toEqual({
      code: "validation",
      fieldErrors: [
        { field: "email", message: "Ingresa un correo electrónico válido." },
      ],
      message: "Revisa los datos de la reserva antes de confirmarla.",
      ok: false,
    });
  });

  it("reports a date range violation as a checkIn/checkOut validation error", async () => {
    requireAdministrator.mockResolvedValueOnce({ user: { id: "admin-1" } });
    createManualReservation.mockRejectedValueOnce(
      new ManualReservationDateRangeError([
        {
          field: "checkIn",
          message: "La fecha de entrada no puede ser anterior a hoy.",
        },
      ])
    );

    await expect(
      createManualReservationAction(new FormData())
    ).resolves.toEqual({
      code: "validation",
      fieldErrors: [
        {
          field: "checkIn",
          message: "La fecha de entrada no puede ser anterior a hoy.",
        },
      ],
      message: "Revisa los datos de la reserva antes de confirmarla.",
      ok: false,
    });
  });

  it("does not expose unexpected creation failures as validation or success", async () => {
    requireAdministrator.mockResolvedValueOnce({ user: { id: "admin-1" } });
    createManualReservation.mockRejectedValueOnce(
      new Error("database host and token details")
    );

    await expect(
      createManualReservationAction(new FormData())
    ).resolves.toEqual({
      code: "unavailable",
      fieldErrors: [],
      message:
        "No pudimos crear la reserva en este momento. Inténtalo nuevamente.",
      ok: false,
    });
  });
});
