import "server-only";

import {
  getPaymentMethodSettingsRepository,
  type PaymentMethodSettingsRepository,
} from "@/features/payments";
import { createProductionDatabase } from "./client";
import { createDrizzlePaymentMethodSettingsRepository } from "./payment-method-settings-repository";
import { createDatabaseBoundary } from "./server";

export function getServerPaymentMethodSettingsRepository(): PaymentMethodSettingsRepository | null {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") {
    return getPaymentMethodSettingsRepository("mock");
  }
  return createDrizzlePaymentMethodSettingsRepository(
    createProductionDatabase(boundary)
  );
}
