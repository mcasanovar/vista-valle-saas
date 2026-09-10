import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import type { RoomReadModel } from "@/features/rooms";
import { createRoomImageStorage } from "@/infrastructure/storage/server";
import {
  amenities,
  roomAmenities,
  roomImages,
  roomOccupancyPrices,
  rooms,
} from "@/persistence/schema";
import { createProductionDatabase, type ProductionDatabase } from "./client";
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

  return loadProductionRoomReadModels(createProductionDatabase(boundary));
}

/**
 * The `db`-injectable core of `queryProductionRooms`, split out so
 * PostgreSQL integration tests can exercise the real join (including
 * `room_occupancy_prices`) against a live database without going through
 * the `VISTA_VALLE_CONFIG_CONTEXT=production` env gate - see
 * `createDrizzleRoomImageRepository` for the same pattern.
 */
export async function loadProductionRoomReadModels(
  db: ProductionDatabase
): Promise<readonly RoomReadModel[]> {
  const imageStorage = createRoomImageStorage();
  const roomRows = await db.select().from(rooms).where(eq(rooms.active, true));
  if (roomRows.length === 0) {
    return [];
  }

  const roomIds = roomRows.map((room) => room.id);
  const [imageRows, amenityRows, occupancyPriceRows] = await Promise.all([
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
    db
      .select({
        occupancy: roomOccupancyPrices.occupancy,
        priceClp: roomOccupancyPrices.priceClp,
        roomId: roomOccupancyPrices.roomId,
      })
      .from(roomOccupancyPrices)
      .where(inArray(roomOccupancyPrices.roomId, roomIds)),
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
      occupancyPrices: occupancyPriceRows
        .filter((entry) => entry.roomId === room.id)
        .map((entry) => ({
          occupancy: entry.occupancy,
          priceClp: entry.priceClp,
        })),
      slug: room.slug ?? "",
    })
  );
}
