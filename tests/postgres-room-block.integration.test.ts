import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { createLodgingInterval, RoomLockConflictError } from "@/features/availability";
import { normalizeRoomBlockListFilter } from "@/features/room-blocks";
import { createDrizzleRoomBlockRepository } from "@/infrastructure/database/room-block-repository";
import { createDrizzleRoomLockGateway } from "@/infrastructure/database/room-lock";
import * as schema from "@/persistence/schema";
import { auditEvents, roomBlocks, rooms } from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";
const actor = "00000000-0000-4000-8000-000000000999";

if (!enabled) {
  describe.skip("PostgreSQL room-block integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL room-block integration", () => {
    const sql = postgres(integrationUrl!, { max: 4 });
    const db = drizzle(sql, { schema });
    const locks = createDrizzleRoomLockGateway(db);
    const repository = createDrizzleRoomBlockRepository(db);

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

    async function createMany(
      roomIds: readonly string[],
      checkIn: string,
      checkOut: string,
      reason: string
    ) {
      const interval = createLodgingInterval(checkIn, checkOut);
      return locks.runExclusiveMany(roomIds, interval, (tx) =>
        repository.createMany(tx, { interval, reason, roomIds }, actor)
      );
    }

    it("inserts every selected room and its audit event in one locked transaction", async () => {
      const roomA = "00000000-0000-4000-8000-000000000501";
      const roomB = "00000000-0000-4000-8000-000000000502";
      await insertRoom(roomA);
      await insertRoom(roomB);

      const created = await createMany(
        [roomB, roomA],
        "2041-05-10",
        "2041-05-13",
        "Integración multi"
      );

      expect(created.map((block) => block.roomId).sort()).toEqual(
        [roomA, roomB]
      );
      const persisted = await db
        .select()
        .from(roomBlocks)
        .where(eq(roomBlocks.reason, "Integración multi"));
      expect(persisted).toHaveLength(2);
      const events = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.action, "room_block.created"));
      expect(
        events.filter((event) => created.some((block) => block.id === event.entityId))
      ).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ actorUserId: actor, entityType: "room_block" }),
          expect.objectContaining({ actorUserId: actor, entityType: "room_block" }),
        ])
      );
    });

    it("rejects a conflicting multi-room request without inserting the otherwise-free room", async () => {
      const occupiedRoom = "00000000-0000-4000-8000-000000000511";
      const freeRoom = "00000000-0000-4000-8000-000000000512";
      await insertRoom(occupiedRoom);
      await insertRoom(freeRoom);
      await createMany(
        [occupiedRoom],
        "2041-06-10",
        "2041-06-13",
        "Integración ocupado"
      );

      await expect(
        createMany(
          [freeRoom, occupiedRoom],
          "2041-06-11",
          "2041-06-14",
          "Integración rollback"
        )
      ).rejects.toBeInstanceOf(RoomLockConflictError);

      expect(
        await db
          .select()
          .from(roomBlocks)
          .where(eq(roomBlocks.reason, "Integración rollback"))
      ).toEqual([]);
      expect(
        await db
          .select()
          .from(auditEvents)
          .where(eq(auditEvents.action, "room_block.created"))
      ).not.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            after: expect.objectContaining({ roomId: freeRoom }),
          }),
        ])
      );
    });

    it("lists active, removed and overlapping blocks and returns creation/removal audit detail", async () => {
      const activeRoom = "00000000-0000-4000-8000-000000000521";
      const removedRoom = "00000000-0000-4000-8000-000000000522";
      await insertRoom(activeRoom);
      await insertRoom(removedRoom);
      const [active] = await createMany(
        [activeRoom],
        "2041-08-10",
        "2041-08-14",
        "Filtro Mantención"
      );
      const [removed] = await createMany(
        [removedRoom],
        "2041-08-12",
        "2041-08-15",
        "Filtro Limpieza"
      );
      await repository.remove(removed!.id, actor);

      const activePage = await repository.list(
        normalizeRoomBlockListFilter({
          reason: "mantenCIÓN",
          roomId: activeRoom,
          status: "active",
        })
      );
      expect(activePage.items).toEqual([
        expect.objectContaining({ id: active!.id, nights: 4 }),
      ]);

      const removedPage = await repository.list(
        normalizeRoomBlockListFilter({ reason: "limpieza", status: "removed" })
      );
      expect(removedPage.items).toEqual([
        expect.objectContaining({ id: removed!.id, nights: 3, removedBy: actor }),
      ]);

      const overlapPage = await repository.list(
        normalizeRoomBlockListFilter({
          checkIn: "2041-08-14",
          checkOut: "2041-08-16",
          status: "all",
        })
      );
      expect(overlapPage.items.map((block) => block.id)).toContain(removed!.id);
      expect(overlapPage.items.map((block) => block.id)).not.toContain(active!.id);

      const detail = await repository.detail(removed!.id);
      expect(detail).toMatchObject({
        id: removed!.id,
        nights: 3,
        removedBy: actor,
      });
      expect(detail?.audit).toEqual([
        expect.objectContaining({ action: "created", actor, blockId: removed!.id }),
        expect.objectContaining({ action: "removed", actor, blockId: removed!.id }),
      ]);
    });

    it("confirms overlapping blocks for every selected room and audits the override, without touching the conflicting block", async () => {
      const occupiedRoom = "00000000-0000-4000-8000-000000000531";
      const freeRoom = "00000000-0000-4000-8000-000000000532";
      await insertRoom(occupiedRoom);
      await insertRoom(freeRoom);
      const [existing] = await createMany(
        [occupiedRoom],
        "2041-09-10",
        "2041-09-13",
        "Integración previa"
      );

      const interval = createLodgingInterval("2041-09-11", "2041-09-14");
      const confirmed = await locks.runLockedMany(
        [freeRoom, occupiedRoom],
        (tx) =>
          repository.createMany(
            tx,
            { interval, reason: "Integración confirmada", roomIds: [freeRoom, occupiedRoom] },
            actor,
            { confirmedWithConflicts: true }
          )
      );

      expect(confirmed.map((block) => block.roomId).sort()).toEqual(
        [freeRoom, occupiedRoom].sort()
      );
      const events = await db
        .select()
        .from(auditEvents)
        .where(eq(auditEvents.action, "room_block.created"));
      for (const block of confirmed)
        expect(events).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              entityId: block.id,
              after: expect.objectContaining({ confirmedWithConflicts: true }),
            }),
          ])
        );

      const untouched = await db
        .select()
        .from(roomBlocks)
        .where(eq(roomBlocks.id, existing!.id));
      expect(untouched).toEqual([
        expect.objectContaining({ id: existing!.id, removedAt: null }),
      ]);
    });
  });
}
