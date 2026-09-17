import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
  createRoomBlocks: vi.fn(),
  revalidatePath: vi.fn(),
  getAudit: vi.fn(),
  auditCreate: vi.fn(),
  auditApprove: vi.fn(),
  auditCancel: vi.fn(),
  auditResult: vi.fn(),
}));
vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));
vi.mock("@/features/room-blocks", () => ({
  createRoomBlocks: mocks.createRoomBlocks,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/features/assistant/interaction-audit", () => ({
  getAssistantInteractionAudit: mocks.getAudit,
}));
import {
  cancelBlockProposalAction,
  confirmBlockProposalAction,
  startBlockProposalAction,
} from "@/features/assistant/actions";

const demoPayload = Object.freeze({
  checkIn: "2044-01-01",
  checkOut: "2044-01-03",
  reason: "Mantenimiento programado",
  roomId: "demo-room-valle",
});

describe("proposal actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAudit.mockReturnValue({
      create: mocks.auditCreate,
      approve: mocks.auditApprove,
      cancel: mocks.auditCancel,
      recordExecutionResult: mocks.auditResult,
    });
  });

  it("blocks unauthenticated confirm and cancel", async () => {
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(confirmBlockProposalAction(new FormData())).rejects.toThrow();
    expect(mocks.auditApprove).not.toHaveBeenCalled();
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(cancelBlockProposalAction(new FormData())).rejects.toThrow();
    expect(mocks.auditCancel).not.toHaveBeenCalled();
  });

  it("confirms by executing the same domain function the room-blocks form uses, then cancels a separate token", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.auditApprove.mockResolvedValue({
      interpretation: { operation: "crear_bloqueo", payload: demoPayload },
    });
    mocks.createRoomBlocks.mockResolvedValue([{ id: "block-1" }]);

    const data = new FormData();
    // Client-supplied fields on the request are never read — the payload
    // comes only from the persisted proposal the token points to.
    data.set("token", "token-1");
    data.set("roomId", "attacker-room");
    data.set("checkIn", "2099-01-01");
    data.set("checkOut", "2099-01-03");
    data.set("reason", "attacker-reason");

    const block = await confirmBlockProposalAction(data);

    expect(mocks.auditApprove).toHaveBeenCalledWith("token-1", "admin-1");
    expect(mocks.createRoomBlocks).toHaveBeenCalledWith(
      {
        checkIn: demoPayload.checkIn,
        checkOut: demoPayload.checkOut,
        reason: demoPayload.reason,
        roomIds: [demoPayload.roomId],
      },
      "admin-1"
    );
    expect(block).toEqual({ id: "block-1" });
    expect(mocks.auditResult).toHaveBeenCalledWith("token-1", "admin-1", {
      data: { blockId: "block-1" },
      outcome: "executed",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/calendario");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/bloqueos");

    await cancelBlockProposalAction(data);
    expect(mocks.auditCancel).toHaveBeenCalledWith("token-1", "admin-1");
  });

  it("requires an administrator and ignores client proposal fields when starting", async () => {
    const clientFields = new FormData();
    clientFields.set("roomId", "invented-room");
    clientFields.set("checkIn", "2099-01-01");
    clientFields.set("checkOut", "2099-01-30");
    clientFields.set("reason", "client-controlled");
    clientFields.set("instruction", "Bloquea la habitación por mantención");

    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(startBlockProposalAction(clientFields)).rejects.toThrow();
    expect(mocks.auditCreate).not.toHaveBeenCalled();

    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });

    const result = await startBlockProposalAction(clientFields);

    expect(result).toEqual({ token: expect.any(String), ...demoPayload });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      actor: "admin-1",
      corrections: [],
      instruction: "Bloquea la habitación por mantención",
      interpretation: { operation: "crear_bloqueo", payload: demoPayload },
      proposalToken: result.token,
    });
  });

  it("records a safe execution failure without retaining provider details", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.auditApprove.mockResolvedValue({
      interpretation: { operation: "crear_bloqueo", payload: demoPayload },
    });
    mocks.createRoomBlocks.mockRejectedValue(
      new Error("provider secret: never expose")
    );
    const data = new FormData();
    data.set("token", "token-1");

    await expect(confirmBlockProposalAction(data)).rejects.toThrow(
      "Assistant unavailable"
    );
    expect(mocks.auditResult).toHaveBeenCalledWith("token-1", "admin-1", {
      code: "unavailable_or_conflict",
      outcome: "failed",
    });
  });
});
