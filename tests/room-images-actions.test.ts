import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listRoomImages: vi.fn(),
  removeRoomImage: vi.fn(),
  reorderRoomImages: vi.fn(),
  RoomImageInputError: class RoomImageInputError extends Error {},
  requireAdministrator: vi.fn(),
  revalidatePath: vi.fn(),
  setPrimaryRoomImage: vi.fn(),
  uploadRoomImages: vi.fn(),
}));
const { RoomImageInputError } = mocks;

vi.mock("@/infrastructure/auth/authorization", () => ({
  requireAdministrator: mocks.requireAdministrator,
}));
vi.mock("@/features/room-images/room-images", () => ({
  listRoomImages: mocks.listRoomImages,
  removeRoomImage: mocks.removeRoomImage,
  reorderRoomImages: mocks.reorderRoomImages,
  RoomImageInputError: mocks.RoomImageInputError,
  setPrimaryRoomImage: mocks.setPrimaryRoomImage,
  uploadRoomImages: mocks.uploadRoomImages,
}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import {
  removeRoomImageAction,
  setPrimaryRoomImageAction,
  uploadRoomImagesAction,
} from "@/features/room-images/actions";

describe("room image actions", () => {
  it("rejects unauthenticated requests before touching the domain", async () => {
    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(uploadRoomImagesAction(new FormData())).rejects.toThrow();
    expect(mocks.uploadRoomImages).not.toHaveBeenCalled();

    mocks.requireAdministrator.mockRejectedValueOnce(new Error("unauthorized"));
    await expect(removeRoomImageAction(new FormData())).rejects.toThrow();
    expect(mocks.removeRoomImage).not.toHaveBeenCalled();
  });

  it("returns a failure result without revalidating when a file is invalid", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-1" } });
    mocks.uploadRoomImages.mockRejectedValueOnce(
      new RoomImageInputError("El archivo debe ser AVIF, JPEG, PNG o WEBP.")
    );

    const data = new FormData();
    data.set("roomId", "demo-room-valle");

    const result = await uploadRoomImagesAction(data);

    expect(result).toEqual({
      message: "El archivo debe ser AVIF, JPEG, PNG o WEBP.",
      ok: false,
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("passes the trusted actor id and revalidates on success", async () => {
    mocks.requireAdministrator.mockResolvedValue({ user: { id: "admin-2" } });
    mocks.setPrimaryRoomImage.mockResolvedValue(undefined);
    mocks.listRoomImages.mockResolvedValue([{ id: "photo-1" }]);

    const data = new FormData();
    data.set("roomId", "demo-room-valle");
    data.set("imageId", "photo-1");

    const result = await setPrimaryRoomImageAction(data);

    expect(mocks.setPrimaryRoomImage).toHaveBeenCalledWith(
      "demo-room-valle",
      "photo-1",
      "admin-2"
    );
    expect(result).toEqual({ ok: true, photos: [{ id: "photo-1" }] });
    expect(mocks.revalidatePath).toHaveBeenCalled();
  });
});
