import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdministrator: vi.fn(),
  createRoomBlock: vi.fn(),
  createRoomBlocks: vi.fn(),
  removeRoomBlock: vi.fn(),
  toSafeRoomBlockConflict: vi.fn(),
  reviewRoomBlocks: vi.fn(),
  confirmRoomBlocks: vi.fn(),
}));
vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));
vi.mock("@/features/room-blocks/manual-blocks", () => ({
  createRoomBlock: mocks.createRoomBlock,
  createRoomBlocks: mocks.createRoomBlocks,
  removeRoomBlock: mocks.removeRoomBlock,
  RoomBlockInputError: class RoomBlockInputError extends Error {},
  toSafeRoomBlockConflict: mocks.toSafeRoomBlockConflict,
  reviewRoomBlocks: mocks.reviewRoomBlocks,
  confirmRoomBlocks: mocks.confirmRoomBlocks,
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import {
  createRoomBlockAction,
  removeRoomBlockAction,
  createRoomBlocksAction,
  reviewRoomBlocksAction,
  confirmRoomBlocksAction,
} from "@/features/room-blocks/actions";

describe("room block actions", () => {
  it("does not call services when authorization fails", async () => {
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(createRoomBlockAction(new FormData())).rejects.toThrow();
    expect(mocks.createRoomBlock).not.toHaveBeenCalled();
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(removeRoomBlockAction(new FormData())).rejects.toThrow();
    expect(mocks.removeRoomBlock).not.toHaveBeenCalled();
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(createRoomBlocksAction(new FormData())).rejects.toThrow();
    expect(mocks.createRoomBlocks).not.toHaveBeenCalled();
  });
  it("passes trusted actor and form values to create and remove", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.createRoomBlock.mockResolvedValue({ id: "block-1" });
    mocks.removeRoomBlock.mockResolvedValue({ id: "block-1" });
    const create = new FormData();
    create.set("roomId", "room-1");
    create.set("checkIn", "2031-01-01");
    create.set("checkOut", "2031-01-02");
    create.set("reason", "maintenance");
    await createRoomBlockAction(create);
    expect(mocks.createRoomBlock).toHaveBeenCalledWith(
      {
        roomId: "room-1",
        checkIn: "2031-01-01",
        checkOut: "2031-01-02",
        reason: "maintenance",
      },
      "admin-1"
    );
    const remove = new FormData();
    remove.set("id", "block-1");
    await removeRoomBlockAction(remove);
    expect(mocks.removeRoomBlock).toHaveBeenCalledWith("block-1", "admin-1");
  });
});
it("returns success, validation, conflict and failure results without sensitive data", async () => {
  mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
  mocks.createRoomBlocks.mockResolvedValue([
    { id: "block-1", roomId: "room-a" },
    { id: "block-2", roomId: "room-b" },
  ]);
  const data = new FormData();
  data.append("roomIds", "room-a");
  data.append("roomIds", "room-b");
  data.set("checkIn", "2031-01-01");
  data.set("checkOut", "2031-01-02");
  data.set("reason", "maintenance");
  await expect(createRoomBlocksAction(data)).resolves.toEqual({
    ok: true,
    blockIds: ["block-1", "block-2"],
    roomIds: ["room-a", "room-b"],
  });
  mocks.createRoomBlocks.mockRejectedValueOnce(new Error("invalid"));
  mocks.toSafeRoomBlockConflict.mockReturnValueOnce(null);
  await expect(createRoomBlocksAction(data)).resolves.toMatchObject({
    ok: false,
    code: "failure",
  });
  mocks.createRoomBlocks.mockRejectedValueOnce(new Error("conflict"));
  mocks.toSafeRoomBlockConflict.mockReturnValueOnce({ roomIds: ["room-b"] });
  await expect(createRoomBlocksAction(data)).resolves.toEqual({
    ok: false,
    code: "conflict",
    roomIds: ["room-b"],
    message: "Una habitación seleccionada ya no está disponible.",
  });
  mocks.createRoomBlocks.mockRejectedValueOnce(
    new (
      await import("@/features/room-blocks/manual-blocks")
    ).RoomBlockInputError("invalid")
  );
  mocks.toSafeRoomBlockConflict.mockReturnValueOnce(null);
  await expect(createRoomBlocksAction(data)).resolves.toMatchObject({
    ok: false,
    code: "validation",
  });
});
describe("review and confirm room block actions", () => {
  const data = new FormData();
  data.append("roomIds", "room-a");
  data.append("roomIds", "room-b");
  data.set("checkIn", "2031-01-01");
  data.set("checkOut", "2031-01-02");
  data.set("reason", "maintenance");

  it("requires authorization before reviewing or confirming", async () => {
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(reviewRoomBlocksAction(data)).rejects.toThrow();
    expect(mocks.reviewRoomBlocks).not.toHaveBeenCalled();
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(confirmRoomBlocksAction(data)).rejects.toThrow();
    expect(mocks.confirmRoomBlocks).not.toHaveBeenCalled();
  });

  it("returns the review result and translates input errors into a safe message", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.reviewRoomBlocks.mockResolvedValueOnce({ kind: "clear", conflicts: [] });
    await expect(reviewRoomBlocksAction(data)).resolves.toEqual({
      kind: "clear",
      conflicts: [],
    });
    const { RoomBlockInputError } = await import(
      "@/features/room-blocks/manual-blocks"
    );
    mocks.reviewRoomBlocks.mockRejectedValueOnce(
      new RoomBlockInputError("Selecciona habitaciones válidas.")
    );
    await expect(reviewRoomBlocksAction(data)).resolves.toEqual({
      kind: "failure",
      message: "Selecciona habitaciones válidas.",
    });
  });

  it("refuses to confirm without an explicit confirmConflicts signal", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    await expect(confirmRoomBlocksAction(data)).resolves.toMatchObject({
      ok: false,
      code: "validation",
    });
    expect(mocks.confirmRoomBlocks).not.toHaveBeenCalled();
  });

  it("confirms with the trusted actor once confirmConflicts is set", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.confirmRoomBlocks.mockResolvedValueOnce([
      { id: "block-1", roomId: "room-a" },
      { id: "block-2", roomId: "room-b" },
    ]);
    const confirmed = new FormData();
    for (const [key, value] of data.entries()) confirmed.append(key, value);
    confirmed.set("confirmConflicts", "true");
    await expect(confirmRoomBlocksAction(confirmed)).resolves.toEqual({
      ok: true,
      blockIds: ["block-1", "block-2"],
      roomIds: ["room-a", "room-b"],
    });
    expect(mocks.confirmRoomBlocks).toHaveBeenCalledWith(
      {
        roomIds: ["room-a", "room-b"],
        checkIn: "2031-01-01",
        checkOut: "2031-01-02",
        reason: "maintenance",
      },
      "admin-1"
    );
  });
});
