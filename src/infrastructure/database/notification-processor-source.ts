import "server-only";

import {
  createNotificationDeliveryWorker,
  createScheduledOutboxProcessor,
  getResendEmailAdapter,
  getScheduledOutboxProcessor,
} from "@/features/notifications";
import { createProductionDatabase } from "./client";
import { createDrizzleNotificationDeliveryOutbox } from "./notification-outbox-repository";
import { createProductionNotificationTemplateDataSource } from "./notification-template-data-source";
import { createDatabaseBoundary } from "./server";

/** Server composition only; browser and presentation layers never reach it. */
export function getServerScheduledOutboxProcessor() {
  const boundary = createDatabaseBoundary();
  if (boundary.context !== "production") return getScheduledOutboxProcessor();

  const db = createProductionDatabase(boundary);
  const adapter = getResendEmailAdapter();
  if (!adapter) return null;
  const outbox = createDrizzleNotificationDeliveryOutbox(db, [
    "company_quotation_customer",
    "company_quotation_admin",
  ]);
  const worker = createNotificationDeliveryWorker(
    outbox,
    adapter,
    createProductionNotificationTemplateDataSource(db)
  );
  return createScheduledOutboxProcessor({
    listReady: outbox.listReady,
    process: worker,
  });
}
