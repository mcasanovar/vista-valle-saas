import { describe, expect, it, vi } from "vitest";

const { config, url, upload, destroy, resources } = vi.hoisted(() => ({
  config: vi.fn(),
  destroy: vi.fn(async () => ({ result: "ok" })),
  resources: vi.fn(
    async () =>
      ({ resources: [] }) as {
        resources: readonly Readonly<{
          bytes: number;
          format: string;
          public_id: string;
        }>[];
      }
  ),
  upload: vi.fn(async () => ({})),
  url: vi.fn(
    () =>
      "https://res.cloudinary.com/mock-cloud/image/upload/room-images/rooms/room-1/photo"
  ),
}));

vi.mock("cloudinary", () => ({
  v2: { api: { resources }, config, uploader: { destroy, upload }, url },
}));

import { createMockRoomImageStorage } from "@/infrastructure/storage/mock";
import {
  createCloudinaryRoomImageStorage,
  createRoomImageStorage,
} from "@/infrastructure/storage/server";

const cloudinaryCredentials = {
  apiKey: "mock-cloudinary-api-key",
  apiSecret: "mock-cloudinary-api-secret",
  cloudName: "mock-cloudinary-cloud-name",
};

const roomId = "00000000-0000-4000-8000-000000000101";
const image = {
  bytes: new Uint8Array([1, 2, 3]),
  contentType: "image/webp" as const,
  path: `rooms/${roomId}/technical-image.webp`,
};

describe("mock room image storage", () => {
  it("is isolated per instance, idempotent, supports CRUD, and never fetches", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const first = createMockRoomImageStorage();
    const second = createMockRoomImageStorage();

    await first.upload(image);
    await first.upload(image);

    expect(await first.list(roomId)).toEqual([
      { contentType: "image/webp", path: image.path, size: 3 },
    ]);
    expect(await second.list(roomId)).toEqual([]);
    expect(first.getPublicUrl(image.path)).toBe(
      `/mock-storage/room-images/${image.path}`
    );

    await first.remove(image.path);
    expect(await first.list(roomId)).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("accepts safe room-id slugs beyond strict UUIDs", async () => {
    const storage = createMockRoomImageStorage();
    const demoImage = { ...image, path: "rooms/demo-room-valle/photo.webp" };

    await storage.upload(demoImage);

    expect(await storage.list("demo-room-valle")).toEqual([
      { contentType: "image/webp", path: demoImage.path, size: 3 },
    ]);
  });

  it("rejects unsafe paths, inconsistent MIME types, and invalid byte limits", async () => {
    const storage = createMockRoomImageStorage();

    await expect(
      storage.upload({ ...image, path: `rooms/${roomId}/../x.webp` })
    ).rejects.toThrow(/path/);
    await expect(
      storage.upload({ ...image, contentType: "image/png" })
    ).rejects.toThrow(/extension/);
    await expect(
      storage.upload({ ...image, bytes: new Uint8Array(0) })
    ).rejects.toThrow(/size/);
    await expect(storage.remove("rooms//image.webp")).rejects.toThrow(/path/);
    await expect(storage.list("")).rejects.toThrow(/room ID/);
    expect(() => storage.getPublicUrl("/rooms/x.webp")).toThrow(/path/);
  });

  it("selects the mock adapter without configuring an SDK client", () => {
    const storage = createRoomImageStorage();

    expect(storage.context).toBe("mock");
    expect(config).not.toHaveBeenCalled();
  });
});

describe("production room image storage (Cloudinary)", () => {
  it("uploads bytes as a base64 data URI under an explicit public ID without extension", async () => {
    const storage = createCloudinaryRoomImageStorage(cloudinaryCredentials);
    expect(storage.context).toBe("production");
    expect(config).toHaveBeenCalledWith(
      expect.objectContaining({ cloud_name: cloudinaryCredentials.cloudName })
    );

    const result = await storage.upload(image);

    expect(upload).toHaveBeenCalledWith(
      `data:image/webp;base64,${Buffer.from(image.bytes).toString("base64")}`,
      expect.objectContaining({
        overwrite: true,
        public_id: `room-images/rooms/${roomId}/technical-image`,
      })
    );
    expect(result).toEqual({
      contentType: "image/webp",
      path: image.path,
      size: 3,
    });
  });

  it("removes by the same public ID it uploaded under", async () => {
    const storage = createCloudinaryRoomImageStorage(cloudinaryCredentials);
    await storage.remove(image.path);

    expect(destroy).toHaveBeenCalledWith(
      `room-images/rooms/${roomId}/technical-image`,
      expect.objectContaining({ resource_type: "image" })
    );
  });

  it("lists resources under the room's folder prefix and rebuilds each path", async () => {
    resources.mockResolvedValueOnce({
      resources: [
        {
          bytes: 42,
          format: "webp",
          public_id: `room-images/rooms/${roomId}/technical-image`,
        },
      ],
    });
    const storage = createCloudinaryRoomImageStorage(cloudinaryCredentials);

    expect(await storage.list(roomId)).toEqual([
      { contentType: "image/webp", path: image.path, size: 42 },
    ]);
    expect(resources).toHaveBeenCalledWith(
      expect.objectContaining({
        prefix: `room-images/rooms/${roomId}/`,
        type: "upload",
      })
    );
  });

  it("builds public URLs from the extension-less public ID", () => {
    const storage = createCloudinaryRoomImageStorage(cloudinaryCredentials);
    storage.getPublicUrl(image.path);

    expect(url).toHaveBeenCalledWith(
      `room-images/rooms/${roomId}/technical-image`,
      expect.objectContaining({ secure: true })
    );
  });

  it("wraps SDK failures in a provider-agnostic error", async () => {
    upload.mockRejectedValueOnce(new Error("cloudinary said no"));
    const storage = createCloudinaryRoomImageStorage(cloudinaryCredentials);

    await expect(storage.upload(image)).rejects.toThrow(
      /room image storage operation/
    );
  });
});
