import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
  execute: vi.fn(),
  cancel: vi.fn(),
  create: vi.fn(),
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
vi.mock("@/features/assistant/proposal-tokens", () => ({
  executeBlockProposalToken: mocks.execute,
  cancelBlockProposalToken: mocks.cancel,
  createBlockProposalToken: mocks.create,
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
    expect(mocks.execute).not.toHaveBeenCalled();
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(cancelBlockProposalAction(new FormData())).rejects.toThrow();
    expect(mocks.cancel).not.toHaveBeenCalled();
  });
  it("forwards token and actor", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.execute.mockResolvedValue({ id: "block-1" });
    const data = new FormData();
    data.set("token", "token-1");
    data.set("roomId", "attacker-room");
    data.set("checkIn", "2099-01-01");
    data.set("checkOut", "2099-01-03");
    data.set("reason", "attacker-reason");
    await confirmBlockProposalAction(data);
    expect(mocks.execute).toHaveBeenCalledWith("token-1", "admin-1");
    await cancelBlockProposalAction(data);
    expect(mocks.cancel).toHaveBeenCalledWith("token-1", "admin-1");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/calendario");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/bloqueos");
    expect(mocks.auditApprove).toHaveBeenCalledWith("token-1", "admin-1");
    expect(mocks.auditResult).toHaveBeenCalledWith("token-1", "admin-1", {
      outcome: "executed",
      blockId: "block-1",
    });
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
    expect(mocks.create).not.toHaveBeenCalled();

    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.create.mockReturnValue({
      token: "proposal-token",
      roomId: "demo-room-valle",
      checkIn: "2044-01-01",
      checkOut: "2044-01-03",
      reason: "Mantenimiento programado",
      actor: "admin-1",
      expiresAt: new Date("2044-01-01T00:00:00.000Z"),
    });

    await expect(startBlockProposalAction(clientFields)).resolves.toEqual({
      token: "proposal-token",
      roomId: "demo-room-valle",
      checkIn: "2044-01-01",
      checkOut: "2044-01-03",
      reason: "Mantenimiento programado",
    });
    expect(mocks.create).toHaveBeenCalledWith({
      roomId: "demo-room-valle",
      checkIn: "2044-01-01",
      checkOut: "2044-01-03",
      reason: "Mantenimiento programado",
      actor: "admin-1",
    });
    expect(mocks.auditCreate).toHaveBeenCalledWith({
      actor: "admin-1",
      instruction: "Bloquea la habitación por mantención",
      interpretation: {
        action: "CREATE_ROOM_BLOCK",
        roomId: "demo-room-valle",
        checkIn: "2044-01-01",
        checkOut: "2044-01-03",
        reason: "Mantenimiento programado",
      },
      corrections: [],
      proposalToken: "proposal-token",
    });
  });

  it("records a safe execution failure without retaining provider details", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.execute.mockRejectedValue(new Error("provider secret: never expose"));
    const data = new FormData();
    data.set("token", "token-1");

    await expect(confirmBlockProposalAction(data)).rejects.toThrow(
      "Assistant unavailable"
    );
    expect(mocks.auditResult).toHaveBeenCalledWith("token-1", "admin-1", {
      outcome: "failed",
      code: "unavailable_or_conflict",
    });
  });
});
