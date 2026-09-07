import { beforeEach, describe, expect, it, vi } from "vitest";

const { boundary, remove, transaction, upload } = vi.hoisted(() => ({
  boundary: { context: "mock" as "mock" | "production" },
  remove: vi.fn(async () => {}),
  transaction: vi.fn(),
  upload: vi.fn(),
}));

vi.mock("@/infrastructure/storage/server", () => ({
  createRoomImageStorage: () => ({
    context: "mock" as const,
    getPublicUrl: (path: string) => `/mock-storage/room-images/${path}`,
    list: async () => [],
    remove,
    upload,
  }),
}));

vi.mock("@/infrastructure/database/server", () => ({
  createDatabaseBoundary: () => boundary,
}));
vi.mock("@/infrastructure/database/client", () => ({
  createProductionDatabase: () => ({ transaction }),
}));

import { uploadRoomImages } from "@/features/room-images";

const files = [
  {
    altText: "Uno",
    bytes: new Uint8Array([1, 2, 3]),
    contentType: "image/webp",
    filename: "one.webp",
  },
  {
    altText: "Dos",
    bytes: new Uint8Array([4, 5, 6]),
    contentType: "image/webp",
    filename: "two.webp",
  },
];

beforeEach(() => {
  boundary.context = "mock";
  remove.mockClear();
  upload.mockReset();
  transaction.mockReset();
});

describe("room image upload rollback", () => {
  it("removes an already-uploaded file when a later file in the same batch fails to upload", async () => {
    upload
      .mockResolvedValueOnce({ contentType: "image/webp", path: "", size: 3 })
      .mockRejectedValueOnce(new Error("storage said no"));

    await expect(
      uploadRoomImages("demo-room-valle", files, "admin-1")
    ).rejects.toThrow(/storage said no/);

    expect(upload).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith(
      expect.stringContaining("rooms/demo-room-valle/")
    );
  });

  it("removes every uploaded file when the database write fails after all uploads succeed", async () => {
    boundary.context = "production";
    upload.mockResolvedValue({ contentType: "image/webp", path: "", size: 3 });
    transaction.mockRejectedValue(new Error("db said no"));

    await expect(
      uploadRoomImages("demo-room-valle", files, "admin-1")
    ).rejects.toThrow(/db said no/);

    expect(upload).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
