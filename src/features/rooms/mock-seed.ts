import { z } from "zod";

export type RoomSeed = Readonly<{
  active: boolean;
  amenities: readonly string[];
  baseNightlyPriceClp: number | null;
  bathroomDescription: string | null;
  bedConfiguration: string | null;
  bedCount: number | null;
  description: string | null;
  id: string;
  images: readonly Readonly<{ altText: string; storagePath: string }>[];
  name: string | null;
  slug: string | null;
  capacity: number | null;
}>;

export const mockRoomSeeds: readonly RoomSeed[] = Object.freeze([
  Object.freeze({
    active: false,
    amenities: [],
    baseNightlyPriceClp: null,
    bathroomDescription: null,
    bedConfiguration: null,
    bedCount: null,
    capacity: null,
    description: null,
    id: "00000000-0000-4000-8000-000000000101",
    images: [],
    name: null,
    slug: null,
  }),
  Object.freeze({
    active: false,
    amenities: [],
    baseNightlyPriceClp: null,
    bathroomDescription: null,
    bedConfiguration: null,
    bedCount: null,
    capacity: null,
    description: null,
    id: "00000000-0000-4000-8000-000000000102",
    images: [],
    name: null,
    slug: null,
  }),
  Object.freeze({
    active: false,
    amenities: [],
    baseNightlyPriceClp: null,
    bathroomDescription: null,
    bedConfiguration: null,
    bedCount: null,
    capacity: null,
    description: null,
    id: "00000000-0000-4000-8000-000000000103",
    images: [],
    name: null,
    slug: null,
  }),
]);

const candidateSchema = z.object({
  active: z.boolean(),
  amenities: z.array(z.string().trim().min(1)),
  baseNightlyPriceClp: z.number().int().positive().nullable(),
  bathroomDescription: z.string().trim().min(1).nullable(),
  bedConfiguration: z.string().trim().min(1).nullable(),
  bedCount: z.number().int().positive().nullable(),
  capacity: z.number().int().positive().nullable(),
  description: z.string().trim().min(1).nullable(),
  id: z.string().uuid(),
  images: z.array(
    z.object({
      altText: z.string().trim().min(1),
      storagePath: z.string().trim().min(1),
    })
  ),
  name: z.string().trim().min(1).nullable(),
  slug: z.string().trim().min(1).nullable(),
});

export type RoomSeedPort = Readonly<{
  upsert: (seed: RoomSeed) => Promise<void>;
}>;

export function assertPublishableRoomCandidate(seed: RoomSeed) {
  candidateSchema.parse(seed);
  if (!seed.active) return;
  const missing = [
    ["slug", seed.slug],
    ["name", seed.name],
    ["description", seed.description],
    ["capacity", seed.capacity],
    ["bedCount", seed.bedCount],
    ["bedConfiguration", seed.bedConfiguration],
    ["bathroomDescription", seed.bathroomDescription],
    ["baseNightlyPriceClp", seed.baseNightlyPriceClp],
    ["images", seed.images.length],
    ["amenities", seed.amenities.length],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length)
    throw new Error(`Room cannot be active; missing: ${missing.join(", ")}`);
}

export async function loadMockRoomSeeds(port: RoomSeedPort) {
  for (const seed of mockRoomSeeds) {
    assertPublishableRoomCandidate(seed);
    await port.upsert(seed);
  }
}
