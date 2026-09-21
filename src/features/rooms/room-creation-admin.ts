export class RoomCreationInputError extends Error {
  readonly code = "ROOM_CREATION_INPUT_INVALID" as const;
}

/** Same normalize-NFD + strip-diacritics + lowercase + dash pattern already duplicated by hand in `scripts/load-room-content.mjs` and `scripts/import-historical-reservations.mjs`, centralized here for both room and amenity slugs. */
export function slugify(text: string): string {
  const slug = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (!slug) {
    throw new RoomCreationInputError(
      "No pudimos generar un identificador a partir de ese nombre."
    );
  }
  return slug;
}

export type RoomDraftInput = Readonly<{
  amenityIds: readonly string[];
  baseNightlyPriceClp: number | null;
  bathroomDescription: string | null;
  bedConfiguration: string | null;
  bedCount: number | null;
  capacity: number | null;
  description: string | null;
  name: string;
  slug: string;
}>;

function normalizePositiveInt(value: unknown, label: string): number | null {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new RoomCreationInputError(`Indica un valor válido para ${label}.`);
  }
  return parsed;
}

function normalizeOptionalText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text.length ? text : null;
}

/** Validates an admin-submitted draft room: only `name` is required, matching the DB schema's nullable columns - any other field, if present, must already satisfy the same positivity rules as the `rooms_*_positive` CHECK constraints. */
export function normalizeRoomDraftInput(candidate: unknown): RoomDraftInput {
  if (!candidate || typeof candidate !== "object") {
    throw new RoomCreationInputError("Datos de habitación inválidos.");
  }
  const value = candidate as Record<string, unknown>;
  const name = String(value.name ?? "").trim();
  if (!name) {
    throw new RoomCreationInputError("Indica un nombre para la habitación.");
  }

  const slugOverride = normalizeOptionalText(value.slug);
  const slug = slugify(slugOverride ?? name);

  const amenityIds = Array.isArray(value.amenityIds)
    ? value.amenityIds.map((id) => String(id)).filter(Boolean)
    : [];

  return Object.freeze({
    amenityIds: Object.freeze(amenityIds),
    baseNightlyPriceClp: normalizePositiveInt(
      value.baseNightlyPriceClp,
      "el precio por noche"
    ),
    bathroomDescription: normalizeOptionalText(value.bathroomDescription),
    bedConfiguration: normalizeOptionalText(value.bedConfiguration),
    bedCount: normalizePositiveInt(value.bedCount, "la cantidad de camas"),
    capacity: normalizePositiveInt(value.capacity, "la capacidad"),
    description: normalizeOptionalText(value.description),
    name,
    slug,
  });
}

export function normalizeAmenityName(candidate: unknown): string {
  const name = String(candidate ?? "").trim();
  if (!name) {
    throw new RoomCreationInputError("Indica un nombre para la amenidad.");
  }
  return name;
}

export type AmenityRecord = Readonly<{ id: string; name: string; slug: string }>;

/** A room row that may still be a draft (`active: false`, partial fields). Mirrors `RoomReadModel` plus `bedCount`, which the read model omits but `rooms_active_complete` requires before activation. */
export type RoomDraftRecord = Readonly<{
  active: boolean;
  amenities: readonly string[];
  bathroom: string;
  bedConfiguration: string;
  bedCount: number | null;
  capacity: number;
  description: string;
  id: string;
  images: readonly Readonly<{ alt: string; id: string; src: string }>[];
  name: string;
  nightlyPriceClp: number;
  slug: string;
}>;

/**
 * Mirrors `isPublishableRoom` (`./read-model.ts`) plus the `bedCount` check
 * from `rooms_active_complete`, which the read model doesn't carry. `imagesCount`
 * is passed in separately rather than read off `room.images` because photos
 * live in a different store (`@/features/room-images`) that this module must
 * not import - see the `assertRoomExists` gap fix in `room-images.ts`.
 */
export function resolveRoomActivationGaps(
  room: Readonly<{
    amenitiesCount: number;
    bathroom: string;
    bedConfiguration: string;
    bedCount: number | null;
    capacity: number;
    description: string;
    imagesCount: number;
    name: string;
    nightlyPriceClp: number;
    slug: string;
  }>
): readonly string[] {
  const gaps: string[] = [];
  if (!room.name.trim()) gaps.push("nombre");
  if (!room.slug.trim()) gaps.push("identificador (slug)");
  if (!room.description.trim()) gaps.push("descripción");
  if (!Number.isSafeInteger(room.capacity) || room.capacity <= 0)
    gaps.push("capacidad");
  if (!Number.isSafeInteger(room.bedCount ?? 0) || (room.bedCount ?? 0) <= 0)
    gaps.push("cantidad de camas");
  if (!room.bedConfiguration.trim()) gaps.push("configuración de camas");
  if (!room.bathroom.trim()) gaps.push("descripción del baño");
  if (!Number.isSafeInteger(room.nightlyPriceClp) || room.nightlyPriceClp <= 0)
    gaps.push("precio por noche");
  if (room.amenitiesCount === 0) gaps.push("al menos 1 amenidad");
  if (room.imagesCount === 0) gaps.push("al menos 1 foto");
  return Object.freeze(gaps);
}

export type RoomCreationRepository = Readonly<{
  activate: (roomId: string, actorUserId: string) => Promise<void>;
  createAmenity: (name: string, actorUserId: string) => Promise<AmenityRecord>;
  createDraft: (
    input: RoomDraftInput,
    actorUserId: string
  ) => Promise<Readonly<{ roomId: string }>>;
  getById: (roomId: string) => Promise<RoomDraftRecord | null>;
  listAmenities: () => Promise<readonly AmenityRecord[]>;
  listDrafts: () => Promise<readonly RoomDraftRecord[]>;
  roomExists: (roomId: string) => Promise<boolean>;
}>;

const seedAmenityNames = [
  "Wi‑Fi",
  "Calefacción",
  "Espacio de trabajo",
  "Toallas",
  "Té y Café",
];

/** In-memory double used only under `VISTA_VALLE_CONFIG_CONTEXT=mock`. */
export function createMockRoomCreationRepository(): RoomCreationRepository & {
  listAll: () => Promise<readonly RoomDraftRecord[]>;
} {
  const rooms = new Map<string, RoomDraftRecord>();
  const amenities = new Map<string, AmenityRecord>();
  for (const name of seedAmenityNames) {
    const slug = slugify(name);
    amenities.set(slug, Object.freeze({ id: slug, name, slug }));
  }

  return Object.freeze({
    activate: async (roomId) => {
      const record = rooms.get(roomId);
      if (!record) {
        throw new RoomCreationInputError("Habitación no encontrada.");
      }
      rooms.set(roomId, Object.freeze({ ...record, active: true }));
    },
    createAmenity: async (name) => {
      const slug = slugify(name);
      const record = Object.freeze({ id: slug, name, slug });
      amenities.set(slug, record);
      return record;
    },
    createDraft: async (input) => {
      const slugTaken = [...rooms.values()].some(
        (room) => room.slug === input.slug
      );
      if (slugTaken) {
        throw new RoomCreationInputError(
          "Ya existe una habitación con ese nombre o identificador."
        );
      }
      const id = crypto.randomUUID();
      const amenityNames = input.amenityIds
        .map((amenityId) => amenities.get(amenityId)?.name)
        .filter((name): name is string => Boolean(name));
      const record: RoomDraftRecord = Object.freeze({
        active: false,
        amenities: Object.freeze(amenityNames),
        bathroom: input.bathroomDescription ?? "",
        bedConfiguration: input.bedConfiguration ?? "",
        bedCount: input.bedCount,
        capacity: input.capacity ?? 0,
        description: input.description ?? "",
        id,
        images: Object.freeze([]),
        name: input.name,
        nightlyPriceClp: input.baseNightlyPriceClp ?? 0,
        slug: input.slug,
      });
      rooms.set(id, record);
      return Object.freeze({ roomId: id });
    },
    getById: async (roomId) => rooms.get(roomId) ?? null,
    listAll: async () => Object.freeze([...rooms.values()]),
    listAmenities: async () =>
      Object.freeze(
        [...amenities.values()].sort((a, b) => a.name.localeCompare(b.name))
      ),
    listDrafts: async () =>
      Object.freeze([...rooms.values()].filter((room) => !room.active)),
    roomExists: async (roomId) => rooms.has(roomId),
  });
}

const canonicalMockRoomCreationRepositoryKey = Symbol.for(
  "vista-valle.mock.room-creation-repository"
);

export function getCanonicalMockRoomCreationRepository() {
  const scope = globalThis as typeof globalThis & {
    [canonicalMockRoomCreationRepositoryKey]?: ReturnType<
      typeof createMockRoomCreationRepository
    >;
  };
  return (scope[canonicalMockRoomCreationRepositoryKey] ??=
    createMockRoomCreationRepository());
}
