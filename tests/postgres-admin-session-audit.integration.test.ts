import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, gte } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { recordAdminSessionAuditEvent } from "@/infrastructure/database/admin-session-audit";
import * as schema from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

if (!enabled) {
  describe.skip("PostgreSQL admin session audit integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL admin session audit integration", () => {
    const openConnections: { end: () => Promise<void> }[] = [];

    afterAll(async () => {
      await Promise.all(
        openConnections.map((connection) =>
          connection.end().catch(() => undefined)
        )
      );
    });

    function openDb() {
      const sql = postgres(integrationUrl!, { max: 1 });
      openConnections.push(sql);
      return drizzle(sql, { schema });
    }

    it("persists a login success, a login failure, and a logout, consultable by date range", async () => {
      const db = openDb();
      const actor = "00000000-0000-4000-8000-000000000901";
      const since = new Date(Date.now() - 1000);

      await recordAdminSessionAuditEvent(
        db,
        "admin_session.login_succeeded",
        actor
      );
      // A failed login before identity verification has no actor to attribute it to.
      await recordAdminSessionAuditEvent(db, "admin_session.login_failed", null);
      await recordAdminSessionAuditEvent(db, "admin_session.logout", actor);

      const rows = await db
        .select()
        .from(schema.auditEvents)
        .where(
          and(
            eq(schema.auditEvents.entityType, "admin_session"),
            gte(schema.auditEvents.occurredAt, since)
          )
        );

      expect(rows.map((row) => row.action).sort()).toEqual(
        [
          "admin_session.login_failed",
          "admin_session.login_succeeded",
          "admin_session.logout",
        ].sort()
      );
      const failed = rows.find(
        (row) => row.action === "admin_session.login_failed"
      );
      expect(failed?.entityId).toBeNull();
      expect(failed?.actorUserId).toBeNull();

      const succeeded = rows.find(
        (row) => row.action === "admin_session.login_succeeded"
      );
      expect(succeeded?.entityId).toBe(actor);
      expect(succeeded?.actorUserId).toBe(actor);
    });
  });
}
