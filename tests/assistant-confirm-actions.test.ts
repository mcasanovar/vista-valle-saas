import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ requireAdministrator: vi.fn() }));
vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import {
  cancelAssistantProposalAction,
  confirmAssistantProposalAction,
} from "@/features/assistant/confirm-actions";
import { proposeAssistantOperation } from "@/features/assistant/propose";
import { confirmPayAtPropertyBooking } from "@/features/reservations/confirm-pay-at-property";
import { getManualRoomBlocks } from "@/features/room-blocks";

const actorUserId = "admin-confirm-1";

function reservationPayload(overrides: Record<string, unknown> = {}) {
  return {
    checkIn: "2049-05-01",
    checkOut: "2049-05-03",
    guest: {
      email: "confirm-test@example.com",
      firstName: "Ana",
      guestCount: 1,
      lastName: "Pérez",
      phone: "+56911111111",
    },
    origin: "phone",
    rooms: [{ guestCount: 1, roomId: "demo-room-terra" }],
    ...overrides,
  };
}

describe("confirmAssistantProposalAction (task 6.2)", () => {
  beforeEach(() => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: actorUserId } });
  });

  it("does not execute a proposal whose availability disappeared between proposal and confirmation", async () => {
    const payload = reservationPayload();
    const { token } = await proposeAssistantOperation({
      actorUserId,
      operation: "crear_reserva",
      payload,
    });

    // Someone else books the same room and dates before the proposal is confirmed.
    await confirmPayAtPropertyBooking({
      room: "demo-room-terra",
      checkIn: payload.checkIn,
      checkOut: payload.checkOut,
      firstName: "Otro",
      lastName: "Huésped",
      email: "otro@example.com",
      phone: "+56922222222",
      guestCount: 1,
    });

    const result = await confirmAssistantProposalAction(token);

    expect(result.ok).toBe(false);
    // Confirming a second time fails too — the token was consumed by the failed attempt.
    await expect(confirmAssistantProposalAction(token)).rejects.toThrow();
  });

  it("executes the real domain function and returns its result when nothing changed", async () => {
    const payload = reservationPayload({
      rooms: [{ guestCount: 1, roomId: "demo-room-andes" }],
    });
    const { token } = await proposeAssistantOperation({
      actorUserId,
      operation: "crear_reserva",
      payload,
    });

    const result = await confirmAssistantProposalAction(token);

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.reservationId).toEqual(expect.any(String));
  });
});

describe("cancelAssistantProposalAction (task 6.3)", () => {
  beforeEach(() => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: actorUserId } });
  });

  it("does not modify data and leaves the token unusable", async () => {
    const blocksBefore = getManualRoomBlocks()!.list().length;
    const { token } = await proposeAssistantOperation({
      actorUserId,
      operation: "crear_bloqueo",
      payload: {
        checkIn: "2049-06-01",
        checkOut: "2049-06-03",
        reason: "Mantenimiento",
        roomIds: ["demo-room-valle"],
      },
    });

    await cancelAssistantProposalAction(token);

    expect(getManualRoomBlocks()!.list()).toHaveLength(blocksBefore);
    await expect(confirmAssistantProposalAction(token)).rejects.toThrow();
    await expect(cancelAssistantProposalAction(token)).rejects.toThrow();
  });
});
