import "server-only";

import { asc, eq, inArray } from "drizzle-orm";
import {
  RoomCreationInputError,
  type RoomCreationRepository,
  type RoomDraftRecord,
} from "@/features/rooms";
import { amenities, auditEvents, roomAmenities, rooms } from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUniqueViolation(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

function toDraftRecord(
  row: typeof rooms.$inferSelect,
  amenityNames: readonly string[]
): RoomDraftRecord {
  return Object.freeze({
    active: row.active,
    amenities: Object.freeze([...amenityNames]),
    bathroom: row.bathroomDescription ?? "",
    bedConfiguration: row.bedConfiguration ?? "",
    bedCount: row.bedCount,
    capacity: row.capacity ?? 0,
    description: row.description ?? "",
    id: row.id,
    images: Object.freeze([]),
    name: row.name ?? "",
    nightlyPriceClp: row.baseNightlyPriceClp ?? 0,
    slug: row.slug ?? "",
  });
}

async function amenityNamesFor(db: ProductionDatabase, roomIds: readonly string[]) {
  if (!roomIds.length) return new Map<string, string[]>();
  const rows = await db
    .select({ name: amenities.name, roomId: roomAmenities.roomId })
    .from(roomAmenities)
    .innerJoin(amenities, eq(roomAmenities.amenityId, amenities.id))
    .where(inArray(roomAmenities.roomId, roomIds));
  const byRoom = new Map<string, string[]>();
  for (const row of rows) {
    const list = byRoom.get(row.roomId) ?? [];
    list.push(row.name);
    byRoom.set(row.roomId, list);
  }
  return byRoom;
}

export function createDrizzleRoomCreationRepository(
  db: ProductionDatabase
): RoomCreationRepository {
  return Object.freeze({
    activate: async (roomId, actorUserId) => {
      try {
        await db.transaction(async (tx) => {
          const [updated] = await tx
            .update(rooms)
            .set({ active: true, updatedAt: new Date() })
            .where(eq(rooms.id, roomId))
            .returning({ id: rooms.id });
          if (!updated) {
            throw new RoomCreationInputError("Habitación no encontrada.");
          }
          await tx.insert(auditEvents).values({
            action: "room.activated",
            actorUserId,
            entityId: roomId,
            entityType: "room",
          });
        });
      } catch (error) {
        if (error instanceof RoomCreationInputError) throw error;
        throw new RoomCreationInputError(
          "No pudimos activar la habitación: faltan datos obligatorios."
        );
      }
    },

    createAmenity: async (name, actorUserId) => {
      const slug = name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      const [row] = await db
        .insert(amenities)
        .values({ name, slug })
        .onConflictDoUpdate({ set: { name }, target: amenities.slug })
        .returning();
      await db.insert(auditEvents).values({
        action: "amenity.created",
        actorUserId,
        entityId: row!.id,
        entityType: "amenity",
      });
      return Object.freeze({ id: row!.id, name: row!.name, slug: row!.slug });
    },

    createDraft: async (input, actorUserId) => {
      try {
        return await db.transaction(async (tx) => {
          const [created] = await tx
            .insert(rooms)
            .values({
              active: false,
              baseNightlyPriceClp: input.baseNightlyPriceClp,
              bathroomDescription: input.bathroomDescription,
              bedConfiguration: input.bedConfiguration,
              bedCount: input.bedCount,
              capacity: input.capacity,
              description: input.description,
              name: input.name,
              slug: input.slug,
            })
            .returning({ id: rooms.id });
          const roomId = created!.id;

          for (const amenityId of input.amenityIds) {
            await tx
              .insert(roomAmenities)
              .values({ amenityId, roomId })
              .onConflictDoNothing();
          }

          await tx.insert(auditEvents).values({
            action: "room.created",
            actorUserId,
            after: { name: input.name, slug: input.slug },
            entityId: roomId,
            entityType: "room",
          });

          return Object.freeze({ roomId });
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new RoomCreationInputError(
            "Ya existe una habitación con ese nombre o identificador."
          );
        }
        throw error;
      }
    },

    getById: async (roomId) => {
      if (!uuidPattern.test(roomId)) return null;
      const [row] = await db.select().from(rooms).where(eq(rooms.id, roomId));
      if (!row) return null;
      const amenityNames = await amenityNamesFor(db, [roomId]);
      return toDraftRecord(row, amenityNames.get(roomId) ?? []);
    },

    listAmenities: async () =>
      db
        .select()
        .from(amenities)
        .orderBy(asc(amenities.name))
        .then((rows) =>
          Object.freeze(
            rows.map((row) =>
              Object.freeze({ id: row.id, name: row.name, slug: row.slug })
            )
          )
        ),

    listDrafts: async () => {
      const rows = await db.select().from(rooms).where(eq(rooms.active, false));
      const amenityNames = await amenityNamesFor(
        db,
        rows.map((row) => row.id)
      );
      return Object.freeze(
        rows.map((row) => toDraftRecord(row, amenityNames.get(row.id) ?? []))
      );
    },

    roomExists: async (roomId) => {
      if (!uuidPattern.test(roomId)) return false;
      const rows = await db
        .select({ id: rooms.id })
        .from(rooms)
        .where(eq(rooms.id, roomId))
        .limit(1);
      return rows.length > 0;
    },
  });
}
