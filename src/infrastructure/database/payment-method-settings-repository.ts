import "server-only";

import { asc, eq } from "drizzle-orm";

import type {
  PaymentMethodSettings,
  PaymentMethodSettingsRepository,
} from "@/features/payments";
import { paymentMethodSettings } from "@/persistence/schema";
import type { ProductionDatabase } from "./client";

const defaultSettings: PaymentMethodSettings = Object.freeze({
  payAtPropertyEnabled: true,
  payOnlineEnabled: true,
});

/**
 * Single-row table (mirrors `createDrizzleCompanyQuotationBreakfastCatalogRepository`),
 * created lazily on first access instead of seeded by a migration INSERT.
 */
export function createDrizzlePaymentMethodSettingsRepository(
  db: ProductionDatabase
): PaymentMethodSettingsRepository {
  const ensureRow = async () => {
    const [row] = await db
      .select({ id: paymentMethodSettings.id })
      .from(paymentMethodSettings)
      .orderBy(asc(paymentMethodSettings.createdAt))
      .limit(1);
    if (row) return row.id;
    const [created] = await db
      .insert(paymentMethodSettings)
      .values(defaultSettings)
      .returning({ id: paymentMethodSettings.id });
    return created.id;
  };

  return Object.freeze({
    get: async () => {
      const [row] = await db
        .select()
        .from(paymentMethodSettings)
        .orderBy(asc(paymentMethodSettings.createdAt))
        .limit(1);
      if (row)
        return Object.freeze({
          payAtPropertyEnabled: row.payAtPropertyEnabled,
          payOnlineEnabled: row.payOnlineEnabled,
        });
      await ensureRow();
      return defaultSettings;
    },
    update: async (input) => {
      const id = await ensureRow();
      const [updated] = await db
        .update(paymentMethodSettings)
        .set({
          payAtPropertyEnabled: input.payAtPropertyEnabled,
          payOnlineEnabled: input.payOnlineEnabled,
          updatedAt: new Date(),
        })
        .where(eq(paymentMethodSettings.id, id))
        .returning();
      return Object.freeze({
        payAtPropertyEnabled: updated.payAtPropertyEnabled,
        payOnlineEnabled: updated.payOnlineEnabled,
      });
    },
  });
}
