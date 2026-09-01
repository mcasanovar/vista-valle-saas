export type RoomDataContext = "mock" | "production";

export type RoomImage = Readonly<{
  alt: string;
  id: string;
  src: string;
}>;

export type RoomReadModel = Readonly<{
  active: boolean;
  amenities: readonly string[];
  bathroom: string;
  bedConfiguration: string;
  capacity: number;
  description: string;
  id: string;
  images: readonly RoomImage[];
  isDemonstration: boolean;
  name: string;
  nightlyPriceClp: number;
  slug: string;
}>;

export type RoomReadSource = Readonly<{
  getActiveBySlug: (slug: string) => RoomReadModel | null;
  listActive: () => readonly RoomReadModel[];
}>;

function isPublishableRoom(room: RoomReadModel) {
  return (
    room.active &&
    room.name.trim().length > 0 &&
    room.slug.trim().length > 0 &&
    room.description.trim().length > 0 &&
    Number.isSafeInteger(room.capacity) &&
    room.capacity > 0 &&
    room.bedConfiguration.trim().length > 0 &&
    room.bathroom.trim().length > 0 &&
    Number.isSafeInteger(room.nightlyPriceClp) &&
    room.nightlyPriceClp > 0 &&
    room.amenities.length > 0 &&
    room.images.length > 0 &&
    room.images.every(
      (image) =>
        image.alt.trim() &&
        (image.src.startsWith("/") || image.src.startsWith("https://"))
    )
  );
}

export function createRoomReadSource(
  context: RoomDataContext,
  records: readonly RoomReadModel[]
): RoomReadSource {
  if (
    context === "production" &&
    records.some((room) => room.isDemonstration)
  ) {
    throw new Error("Demonstration rooms are not permitted in production");
  }

  const activeRooms = Object.freeze(
    records.filter(isPublishableRoom).map((room) => Object.freeze(room))
  );
  const slugs = new Set(activeRooms.map((room) => room.slug));

  if (slugs.size !== activeRooms.length) {
    throw new Error("Active room slugs must be unique");
  }

  return Object.freeze({
    getActiveBySlug: (slug) =>
      activeRooms.find((room) => room.slug === slug) ?? null,
    listActive: () => activeRooms,
  });
}
