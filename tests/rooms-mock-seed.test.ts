import { describe, expect, it, vi } from "vitest";
import {
  assertPublishableRoomCandidate,
  loadMockRoomSeeds,
  mockRoomSeeds,
} from "@/features/rooms";

describe("mock room seeds", () => {
  it("contains exactly three stable unpublished technical records without commercial content", () => {
    expect(mockRoomSeeds).toHaveLength(3);
    expect(new Set(mockRoomSeeds.map((room) => room.id)).size).toBe(3);
    for (const room of mockRoomSeeds)
      expect(room).toMatchObject({
        active: false,
        amenities: [],
        baseNightlyPriceClp: null,
        images: [],
        name: null,
        slug: null,
      });
  });
  it("loads idempotently without network activity", async () => {
    const stored = new Map<string, unknown>();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const port = {
      upsert: async (seed: (typeof mockRoomSeeds)[number]) => {
        stored.set(seed.id, seed);
      },
    };
    await loadMockRoomSeeds(port);
    await loadMockRoomSeeds(port);
    expect(stored.size).toBe(3);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
  it("rejects incomplete active rooms without leaking values", () => {
    const candidate = { ...mockRoomSeeds[0], active: true };
    expect(() => assertPublishableRoomCandidate(candidate)).toThrow(
      /slug, name, description/
    );
    expect(() => assertPublishableRoomCandidate(candidate)).not.toThrow(
      /00000000/
    );
  });
});
