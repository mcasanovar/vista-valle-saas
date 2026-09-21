import "server-only";

import { getServerEnvironment } from "@/config/server";
import { createProductionDatabase } from "@/infrastructure/database/client";
import { createDrizzleRoomCreationRepository } from "@/infrastructure/database/room-creation-repository";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import { queryProductionRooms } from "@/infrastructure/database/room-source";
import { createRoomImageStorage } from "@/infrastructure/storage/server";
import { mockDemoRooms } from "./mock-fixtures";
import { createRoomReadSource, type RoomReadModel } from "./read-model";
import {
  getCanonicalMockRoomCreationRepository,
  type RoomDraftRecord,
} from "./room-creation-admin";
import { getCanonicalMockRoomPricingRepository } from "./room-pricing-admin";

/**
 * Reads the same well-known global map `@/features/room-images/room-images.ts`
 * populates under `VISTA_VALLE_CONFIG_CONTEXT=mock`, by the identical
 * `Symbol.for` key literal - deliberately not importing that feature's
 * module here, which would create a cycle (`room-images.ts` already imports
 * from this feature's barrel).
 */
function mockImagesFor(roomId: string, roomName: string) {
  const key = Symbol.for("vista-valle.mock.room-images");
  const store = (
    globalThis as unknown as {
      [key: symbol]:
        | Map<
            string,
            readonly Readonly<{
              altText: string;
              id: string;
              position: number;
              storagePath: string;
            }>[]
          >
        | undefined;
    }
  )[key];
  const records = [...(store?.get(roomId) ?? [])].sort(
    (a, b) => a.position - b.position
  );
  const storage = createRoomImageStorage();
  return records.map((record) =>
    Object.freeze({
      // Mirrors `loadProductionRoomReadModels`'s read-time fallback: a photo
      // uploaded with no caption still counts as having valid alt text.
      alt: record.altText?.trim() || roomName.trim() || "",
      id: record.id,
      src: storage.getPublicUrl(record.storagePath),
    })
  );
}

async function listMockCreatedRooms(): Promise<readonly RoomReadModel[]> {
  const created = await getCanonicalMockRoomCreationRepository().listAll();
  return created.map((room) =>
    Object.freeze({
      ...room,
      images: Object.freeze(mockImagesFor(room.id, room.name)),
      isDemonstration: false,
      occupancyPrices: Object.freeze([]),
    })
  );
}

/** Layers any admin-saved mock tariff override onto its room, so `/admin/habitaciones/[roomId]/tarifas` is reflected in the public mock site immediately (see `admin-room-pricing` spec). Applies to both the static demo fixtures and rooms created via the admin "Nueva habitación" flow. */
function withMockPricingOverrides(rooms: readonly RoomReadModel[]) {
  const repository = getCanonicalMockRoomPricingRepository();
  return rooms.map((room) => {
    const override = repository.overrideFor(room.id);
    if (!override) return room;
    return Object.freeze({
      ...room,
      occupancyPrices: Object.freeze(
        override.prices.map((priceClp, index) =>
          Object.freeze({ occupancy: index + 1, priceClp })
        )
      ),
    });
  });
}

export async function getRoomReadSource() {
  const context = getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT;
  const records =
    context === "mock"
      ? withMockPricingOverrides([
          ...mockDemoRooms,
          ...(await listMockCreatedRooms()),
        ])
      : await queryProductionRooms();
  return createRoomReadSource(context, records);
}

/** Draft (`active: false`) rooms - created but not yet publishable - for the admin "Borradores" list; never surfaced through `getRoomReadSource`. */
export async function getRoomDraftSource(): Promise<
  readonly RoomDraftRecord[]
> {
  const context = getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT;
  if (context === "mock") {
    return getCanonicalMockRoomCreationRepository().listDrafts();
  }
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") return [];
  return createDrizzleRoomCreationRepository(
    createProductionDatabase(boundary)
  ).listDrafts();
}
