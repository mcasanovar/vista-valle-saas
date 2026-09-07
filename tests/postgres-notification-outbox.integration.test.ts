import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";

import { createDrizzleNotificationDeliveryOutbox } from "@/infrastructure/database/notification-outbox-repository";
import * as schema from "@/persistence/schema";
import { notificationOutbox } from "@/persistence/schema";

const integrationUrl = process.env.VISTA_VALLE_POSTGRES_INTEGRATION_URL;
const enabled =
  process.env.POSTGRES_RESERVATION_INTEGRATION_ENABLED === "true" &&
  typeof integrationUrl === "string";

if (!enabled) {
  describe.skip("PostgreSQL notification outbox integration", () => {
    it("requires the explicit integration runner", () => {});
  });
} else {
  describe("PostgreSQL notification outbox integration", () => {
    const sql = postgres(integrationUrl!, { max: 3 });
    const db = drizzle(sql, { schema });
    const outbox = createDrizzleNotificationDeliveryOutbox(db);

    afterAll(async () => {
      await sql.end({ timeout: 5 });
    });

    async function createIntent(key: string) {
      const [intent] = await db
        .insert(notificationOutbox)
        .values({
          idempotencyKey: key,
          payload: {},
          recipient: "outbox-integration@example.test",
          type: "company_quotation_customer",
        })
        .returning();
      return intent!;
    }

    it("claims an intent once across concurrent schedulers and never redelivers it", async () => {
      const intent = await createIntent("outbox-concurrent-claim");
      const now = new Date("2032-01-01T00:00:00.000Z");
      const claims = await Promise.all([
        outbox.startDelivery(intent.id, now),
        outbox.startDelivery(intent.id, now),
      ]);

      expect(claims.filter(Boolean)).toHaveLength(1);
      const claimed = claims.find(Boolean);
      expect(claimed).toMatchObject({ attempts: 1, status: "processing" });
      await outbox.completeDelivery(intent.id, now);
      await expect(outbox.startDelivery(intent.id, now)).resolves.toBeNull();
      expect(
        await db
          .select()
          .from(notificationOutbox)
          .where(eq(notificationOutbox.id, intent.id))
      ).toMatchObject([{ attempts: 1, status: "delivered" }]);
    });

    it("persists a safe retry code and only returns the intent after its retry time", async () => {
      const intent = await createIntent("outbox-retry");
      const now = new Date("2032-01-02T00:00:00.000Z");
      const retryAt = new Date("2032-01-02T00:02:00.000Z");

      await outbox.startDelivery(intent.id, now);
      await outbox.failDelivery(intent.id, {
        errorCode: "delivery_transient",
        now,
        retryAt,
      });

      expect(await outbox.listReady(now)).toEqual([]);
      expect(await outbox.listReady(retryAt)).toMatchObject([
        {
          id: intent.id,
          lastErrorCode: "delivery_transient",
          status: "retrying",
        },
      ]);
    });
  });
}
