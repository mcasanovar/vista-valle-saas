import "server-only";

import { getServerEnvironment } from "@/config/server";

import { createNotificationDeliveryWorker } from "./delivery-worker";
import { getMockNotificationOutboxRepository } from "./outbox";
import { createMockResendEmailAdapter } from "./resend-adapter";
import { getMockNotificationTemplateDataSource } from "./template-data-source";

export type ScheduledOutboxProcessorResult = Readonly<{
  processed: number;
  stopped: "batch_limit" | "no_ready" | "time_budget";
}>;

type DeliveryProcessor = Readonly<{
  process: (outboxId: string) => Promise<void>;
}>;

type ScheduledOutboxProcessorDependencies = Readonly<{
  listReady: (
    now: Date
  ) =>
    | readonly Readonly<{ id: string }>[]
    | Promise<readonly Readonly<{ id: string }>[]>;
  now?: () => Date;
  process: DeliveryProcessor;
}>;

const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_TIME_BUDGET_MS = 5_000;

/**
 * Processes a snapshot of ready intents once. A bounded snapshot and explicit
 * deadline prevent an invocation from becoming an unbounded serverless job.
 */
export function createScheduledOutboxProcessor(
  dependencies: ScheduledOutboxProcessorDependencies,
  batchSize = DEFAULT_BATCH_SIZE,
  timeBudgetMs = DEFAULT_TIME_BUDGET_MS
) {
  const now = dependencies.now ?? (() => new Date());
  const safeBatchSize = Math.max(1, Math.min(batchSize, DEFAULT_BATCH_SIZE));
  const safeTimeBudgetMs = Math.max(1, timeBudgetMs);

  return Object.freeze({
    run: async (): Promise<ScheduledOutboxProcessorResult> => {
      const startedAt = now().getTime();
      const ready = (await dependencies.listReady(now())).slice(
        0,
        safeBatchSize
      );
      if (ready.length === 0) return { processed: 0, stopped: "no_ready" };

      let processed = 0;
      for (const intent of ready) {
        if (now().getTime() - startedAt >= safeTimeBudgetMs) {
          return { processed, stopped: "time_budget" };
        }
        await dependencies.process.process(intent.id);
        processed += 1;
      }
      return {
        processed,
        stopped:
          (await dependencies.listReady(now())).length > 0 &&
          processed === safeBatchSize
            ? "batch_limit"
            : "no_ready",
      };
    },
  });
}

export function getScheduledOutboxProcessor() {
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock") return null;
  const outbox = getMockNotificationOutboxRepository();
  const source = getMockNotificationTemplateDataSource();
  if (!outbox || !source) return null;
  const worker = createNotificationDeliveryWorker(
    outbox,
    createMockResendEmailAdapter(),
    source
  );
  return createScheduledOutboxProcessor({
    listReady: outbox.listReady,
    process: worker,
  });
}
