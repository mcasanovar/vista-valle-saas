import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  collectPayAtPropertyWithResult: vi.fn(),
  createManualReservationFromInputResolved: vi.fn(),
  editAdminReservationDatesWithResult: vi.fn(),
  markPaymentPaidWithResult: vi.fn(),
  transitionAdminReservationWithResult: vi.fn(),
}));

vi.mock("@/features/admin", () => ({
  collectPayAtPropertyWithResult: mocks.collectPayAtPropertyWithResult,
  createManualReservationFromInputResolved:
    mocks.createManualReservationFromInputResolved,
  editAdminReservationDatesWithResult: mocks.editAdminReservationDatesWithResult,
  markPaymentPaidWithResult: mocks.markPaymentPaidWithResult,
  transitionAdminReservationWithResult: mocks.transitionAdminReservationWithResult,
}));
vi.mock("@/features/room-blocks", () => ({
  createRoomBlocks: vi.fn(),
  removeRoomBlock: vi.fn(),
}));

import { executeAssistantOperation } from "@/features/assistant/execute-operation";

describe("executeAssistantOperation dispatcher", () => {
  it("editar_fechas: a conflicting interval reported by the domain function is not treated as applied (task 6.5)", async () => {
    mocks.editAdminReservationDatesWithResult.mockResolvedValue({
      code: "conflict",
      message: "Las nuevas fechas ya no están disponibles.",
      ok: false,
    });

    await expect(
      executeAssistantOperation(
        "editar_fechas",
        { checkIn: "2030-01-01", checkOut: "2030-01-03", reservationId: "r-1" },
        "admin-1"
      )
    ).rejects.toThrow("Las nuevas fechas ya no están disponibles.");
  });

  it("cambiar_estado: cancelling forwards only reservationId/to — no payment function is ever called (task 6.6)", async () => {
    mocks.transitionAdminReservationWithResult.mockResolvedValue({
      ok: true,
      reservation: { id: "r-1", status: "cancelled" },
    });

    const result = await executeAssistantOperation(
      "cambiar_estado",
      // Extraneous payment fields, as if something upstream tried to smuggle them in.
      {
        amountClp: 100_000,
        paymentStatus: "approved",
        reservationId: "r-1",
        to: "cancelled",
      },
      "admin-1"
    );

    expect(mocks.transitionAdminReservationWithResult).toHaveBeenCalledWith({
      actorUserId: "admin-1",
      reservationId: "r-1",
      to: "cancelled",
    });
    expect(mocks.markPaymentPaidWithResult).not.toHaveBeenCalled();
    expect(mocks.collectPayAtPropertyWithResult).not.toHaveBeenCalled();
    expect(result).toEqual({ reservationId: "r-1", status: "cancelled" });
  });

  it("cambiar_estado: a rejected transition is not treated as applied", async () => {
    mocks.transitionAdminReservationWithResult.mockResolvedValue({
      code: "invalid_transition",
      message: "Reservation cannot transition from cancelled to completed",
      ok: false,
    });

    await expect(
      executeAssistantOperation(
        "cambiar_estado",
        { reservationId: "r-1", to: "completed" },
        "admin-1"
      )
    ).rejects.toThrow(/cannot transition/);
  });

  it("registrar_cobro: a payment in a non-collectible state is rejected (task 6.8)", async () => {
    mocks.collectPayAtPropertyWithResult.mockResolvedValue({
      code: "not_found",
      message: "Esta reserva no tiene un pago presencial pendiente.",
      ok: false,
    });

    await expect(
      executeAssistantOperation(
        "registrar_cobro",
        {
          amountClp: 50_000,
          collectedOn: "2030-01-01",
          medium: "efectivo",
          reservationId: "r-1",
        },
        "admin-1"
      )
    ).rejects.toThrow("no tiene un pago presencial pendiente");
  });

  it("rejects an unknown operation", async () => {
    await expect(
      executeAssistantOperation("no_existe", {}, "admin-1")
    ).rejects.toThrow("Unknown assistant operation");
  });
});
