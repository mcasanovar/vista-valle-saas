import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import type { RoomReadModel } from "@/features/rooms";
import { createRoomImageStorage } from "@/infrastructure/storage/server";
import { amenities, roomAmenities, roomImages, rooms } from "@/persistence/schema";
import { createProductionDatabase } from "./client";
import { createDatabaseBoundary } from "./server";

/**
 * Drizzle/PostgreSQL-backed candidate rooms for `createRoomReadSource`
 * (`@/features/rooms/read-model`) under `production`. Returns every row
 * marked `active` in Postgres, joined with its images (ordered by
 * `position`) and amenity names - `createRoomReadSource` still applies
 * `isPublishableRoom` on top, so an active-but-incomplete row is dropped
 * there, not here. Returns `[]` outside `production` (see
 * `createDatabaseBoundary`, `src/infrastructure/database/server.ts`).
 */
export async function queryProductionRooms(): Promise<
  readonly RoomReadModel[]
> {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return [];
  }

  const db = createProductionDatabase(boundary);
  const imageStorage = createRoomImageStorage();
  const roomRows = await db.select().from(rooms).where(eq(rooms.active, true));
  if (roomRows.length === 0) {
    return [];
  }

  const roomIds = roomRows.map((room) => room.id);
  const [imageRows, amenityRows] = await Promise.all([
    db
      .select()
      .from(roomImages)
      .where(inArray(roomImages.roomId, roomIds))
      .orderBy(asc(roomImages.position)),
    db
      .select({ name: amenities.name, roomId: roomAmenities.roomId })
      .from(roomAmenities)
      .innerJoin(amenities, eq(roomAmenities.amenityId, amenities.id))
      .where(inArray(roomAmenities.roomId, roomIds)),
  ]);

  return roomRows.map(
    (room): RoomReadModel => ({
      active: room.active,
      amenities: amenityRows
        .filter((amenity) => amenity.roomId === room.id)
        .map((amenity) => amenity.name),
      bathroom: room.bathroomDescription ?? "",
      bedConfiguration: room.bedConfiguration ?? "",
      capacity: room.capacity ?? 0,
      description: room.description ?? "",
      id: room.id,
      images: imageRows
        .filter((image) => image.roomId === room.id)
        .map((image) => ({
          alt: image.altText?.trim() || room.name?.trim() || "",
          id: image.id,
          src: imageStorage.getPublicUrl(image.storagePath),
        })),
      isDemonstration: false,
      name: room.name ?? "",
      nightlyPriceClp: room.baseNightlyPriceClp ?? 0,
      slug: room.slug ?? "",
    })
  );
}
