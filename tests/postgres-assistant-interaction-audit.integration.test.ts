import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { createDrizzleAssistantInteractionAudit } from "@/features/assistant/interaction-audit";
import * as schema from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

if (!enabled) {
  describe.skip("PostgreSQL assistant interaction audit integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL assistant interaction audit integration", () => {
    const openConnections: { end: () => Promise<void> }[] = [];

    afterAll(async () => {
      await Promise.all(
        openConnections.map((connection) =>
          connection.end().catch(() => undefined)
        )
      );
    });

    function openAudit() {
      const sql = postgres(integrationUrl!, { max: 1 });
      openConnections.push(sql);
      return createDrizzleAssistantInteractionAudit(
        drizzle(sql, { schema })
      );
    }

    it("persists an interaction across independent connections, as if the process restarted", async () => {
      const token = "integration-restart-token";
      const actor = "00000000-0000-4000-8000-000000000801";

      const firstConnectionAudit = openAudit();
      const created = await firstConnectionAudit.create({
        actor,
        instruction: "Bloquea la habitación Andes por mantenimiento",
        interpretation: {
          operation: "crear_bloqueo",
          payload: {
            roomId: "00000000-0000-4000-8000-000000000802",
            checkIn: "2048-01-01",
            checkOut: "2048-01-03",
            reason: "Mantenimiento programado",
          },
        },
        corrections: [],
        proposalToken: token,
      });
      expect(created.status).toBe("previewed");

      // A brand-new connection and a brand-new audit instance stand in for
      // a fresh process: nothing here is shared in-memory with the write
      // above, so reading the row back proves it lives in Postgres.
      const secondConnectionAudit = openAudit();
      const approved = await secondConnectionAudit.approve(token, actor);
      expect(approved.status).toBe("approved");

      const thirdConnectionAudit = openAudit();
      const executed = await thirdConnectionAudit.recordExecutionResult(
        token,
        actor,
        { outcome: "executed", data: { blockId: "integration-block-id" } }
      );
      expect(executed).toMatchObject({
        status: "executed",
        result: { outcome: "executed", data: { blockId: "integration-block-id" } },
        instruction: "Bloquea la habitación Andes por mantenimiento",
      });
    });
  });
}
