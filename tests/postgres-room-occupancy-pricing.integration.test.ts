import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { loadProductionRoomReadModels } from "@/infrastructure/database/room-source";
import * as schema from "@/persistence/schema";
import { roomOccupancyPrices, rooms } from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

if (!enabled) {
  describe.skip("PostgreSQL room-occupancy-pricing integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL room-occupancy-pricing integration", () => {
    const sql = postgres(integrationUrl!, { max: 4 });
    const db = drizzle(sql, { schema });

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    async function insertPublishedRoom(id: string, name: string) {
      await db.insert(rooms).values({
        active: true,
        bedCount: 1,
        bathroomDescription: "Baño privado",
        baseNightlyPriceClp: 45_000,
        bedConfiguration: "1 cama matrimonial",
        capacity: 2,
        description: `${name} de prueba`,
        id,
        name,
        slug: id,
      });
    }

    it("resolves occupancy prices for a room with differentiated tariffs", async () => {
      const roomId = "00000000-0000-4000-8000-000000000701";
      await insertPublishedRoom(roomId, "Habitación Doble de prueba");
      await db.insert(roomOccupancyPrices).values([
        { occupancy: 1, priceClp: 55_000, roomId },
        { occupancy: 2, priceClp: 70_000, roomId },
      ]);

      const [room] = (await loadProductionRoomReadModels(db)).filter(
        (candidate) => candidate.id === roomId
      );

      expect(room?.occupancyPrices).toEqual(
        expect.arrayContaining([
          { occupancy: 1, priceClp: 55_000 },
          { occupancy: 2, priceClp: 70_000 },
        ])
      );
      expect(room?.occupancyPrices).toHaveLength(2);
    });

    it("returns no occupancy prices for a room without configured tariffs", async () => {
      const roomId = "00000000-0000-4000-8000-000000000702";
      await insertPublishedRoom(roomId, "Habitación Matrimonial de prueba");

      const [room] = (await loadProductionRoomReadModels(db)).filter(
        (candidate) => candidate.id === roomId
      );

      expect(room?.occupancyPrices).toEqual([]);
      expect(room?.nightlyPriceClp).toBe(45_000);
    });
  });
}
