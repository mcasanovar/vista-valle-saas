import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));

import { createMockRoomImageStorage } from "@/infrastructure/storage/mock";
import { createRoomImageStorage } from "@/infrastructure/storage/server";

const roomId = "00000000-0000-4000-8000-000000000101";
const image = {
  bytes: new Uint8Array([1, 2, 3]),
  contentType: "image/webp" as const,
  path: `rooms/${roomId}/technical-image.webp`,
};

describe("room image storage", () => {
  it("is isolated, idempotent, supports CRUD, and never fetches", async () => {
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
    await expect(storage.remove("rooms/not-a-uuid/image.webp")).rejects.toThrow(
      /path/
    );
    await expect(storage.list("not-a-uuid")).rejects.toThrow(/room ID/);
    expect(() => storage.getPublicUrl("/rooms/x.webp")).toThrow(/path/);
  });

  it("selects the mock adapter without creating an SDK client", () => {
    const storage = createRoomImageStorage();

    expect(storage.context).toBe("mock");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("declares an idempotent public-read-only bucket policy", async () => {
    const sql = await readFile("supabase/storage/room-images.sql", "utf8");

    expect(sql).toContain("room-images");
    expect(sql).toMatch(/on conflict/i);
    expect(sql).toMatch(/drop policy if exists/i);
    // storage.objects ships with RLS enabled by Supabase itself; this
    // connection's role cannot ALTER it and does not need to (see
    // openspec/changes/configure-production-supabase task 4.2).
    expect(sql).toMatch(/row level security enabled by supabase/i);
    expect(sql).not.toMatch(/alter table storage\.objects enable row level security/i);
    expect(sql).toMatch(/for select/i);
    expect(sql).not.toMatch(/for (insert|update|delete)/i);
  });
});
