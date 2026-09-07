import { asc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { createDrizzleRoomImageRepository } from "@/infrastructure/database/room-image-repository";
import * as schema from "@/persistence/schema";
import { auditEvents, roomImages, rooms } from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";
const actor = "00000000-0000-4000-8000-000000000999";

if (!enabled) {
  describe.skip("PostgreSQL room-images integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL room-images integration", () => {
    const sql = postgres(integrationUrl!, { max: 4 });
    const db = drizzle(sql, { schema });
    const repository = createDrizzleRoomImageRepository(db);

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    async function insertRoom(id: string) {
      await db.insert(rooms).values({
        active: false,
        baseNightlyPriceClp: 60_000,
        capacity: 2,
        id,
      });
    }

    it("appends uploads after the current highest position and audits each one", async () => {
      const roomId = "00000000-0000-4000-8000-000000000601";
      await insertRoom(roomId);

      const first = await db.transaction((tx) =>
        repository.appendMany(
          tx,
          roomId,
          [{ altText: "Uno", storagePath: `rooms/${roomId}/one.webp` }],
          actor
        )
      );
      const second = await db.transaction((tx) =>
        repository.appendMany(
          tx,
          roomId,
          [{ altText: "Dos", storagePath: `rooms/${roomId}/two.webp` }],
          actor
        )
      );

      expect(first[0]).toMatchObject({ position: 0 });
      expect(second[0]).toMatchObject({ position: 1 });

      const events = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.entityType, "room_image"));
      expect(events.filter((event) => event.action === "room_image.uploaded"))
        .toHaveLength(2);
    });

    it("rewrites positions atomically for a reorder without violating the unique index", async () => {
      const roomId = "00000000-0000-4000-8000-000000000602";
      await insertRoom(roomId);
      const [a, b, c] = await db.transaction((tx) =>
        repository.appendMany(
          tx,
          roomId,
          [
            { altText: "A", storagePath: `rooms/${roomId}/a.webp` },
            { altText: "B", storagePath: `rooms/${roomId}/b.webp` },
            { altText: "C", storagePath: `rooms/${roomId}/c.webp` },
          ],
          actor
        )
      );

      await db.transaction((tx) =>
        repository.persistOrder(
          tx,
          roomId,
          [c!.id, a!.id, b!.id],
          actor,
          "room_image.reordered"
        )
      );

      const rows = await db
        .select()
        .from(roomImages)
        .where(eq(roomImages.roomId, roomId))
        .orderBy(asc(roomImages.position));
      expect(rows.map((row) => row.id)).toEqual([c!.id, a!.id, b!.id]);
      expect(rows.map((row) => row.position)).toEqual([0, 1, 2]);
    });

    it("removing the primary photo leaves the next one promotable to position 0", async () => {
      const roomId = "00000000-0000-4000-8000-000000000603";
      await insertRoom(roomId);
      const [primary, secondary] = await db.transaction((tx) =>
        repository.appendMany(
          tx,
          roomId,
          [
            { altText: "Principal", storagePath: `rooms/${roomId}/primary.webp` },
            { altText: "Secundaria", storagePath: `rooms/${roomId}/secondary.webp` },
          ],
          actor
        )
      );

      const removed = await db.transaction((tx) =>
        repository.remove(tx, roomId, primary!.id, actor)
      );
      expect(removed.id).toBe(primary!.id);

      await db.transaction((tx) =>
        repository.persistOrder(
          tx,
          roomId,
          [secondary!.id],
          actor,
          "room_image.reordered"
        )
      );

      const rows = await db
        .select()
        .from(roomImages)
        .where(eq(roomImages.roomId, roomId));
      expect(rows).toEqual([
        expect.objectContaining({ id: secondary!.id, position: 0 }),
      ]);

      const removalEvents = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.action, "room_image.removed"));
      expect(removalEvents.some((event) => event.entityId === primary!.id)).toBe(
        true
      );
    });
  });
}
