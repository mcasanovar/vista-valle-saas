import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
  getChannelSyncTasks: vi.fn(),
  complete: vi.fn(),
}));
vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));
vi.mock("@/features/channel-sync/tasks", () => ({
  getChannelSyncTasks: mocks.getChannelSyncTasks,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { completeChannelSyncTaskAction } from "@/features/channel-sync/actions";
describe("channel sync action", () => {
  it("blocks unauthenticated calls", async () => {
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(
      completeChannelSyncTaskAction(new FormData())
    ).rejects.toThrow();
    expect(mocks.complete).not.toHaveBeenCalled();
  });
  it("forwards id and actor", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.getChannelSyncTasks.mockReturnValue({ complete: mocks.complete });
    const data = new FormData();
    data.set("id", "task-1");
    await completeChannelSyncTaskAction(data);
    expect(mocks.complete).toHaveBeenCalledWith("task-1", "admin-1");
  });
});
