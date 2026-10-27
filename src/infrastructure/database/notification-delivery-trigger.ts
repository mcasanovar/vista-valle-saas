import "server-only";

import { after } from "next/server";

import { getServerScheduledOutboxProcessor } from "./notification-processor-source";

/**
 * `after()` throws synchronously when called outside a real Next.js request
 * scope - which is exactly what happens when a route handler is invoked
 * directly, as this project's tests do, bypassing the Next router that
 * normally sets up that scope. In an actual deployment the router always
 * provides it, so this falls back to firing the task without blocking only
 * in that direct-invocation case.
 */
export function runAfterResponse(task: () => Promise<void>) {
  try {
    after(task);
  } catch {
    void task();
  }
}

/**
 * Attempts delivery of exactly these outbox rows once the response has been
 * sent, so a confirmation email leaves within seconds of the booking rather
 * than on the next sweep of the outbox cron. Best effort by construction:
 * the intents stay in the outbox, and the cron retries anything this misses
 * (including the whole batch when the invocation is torn down early).
 */
export function deliverNotificationsAfterResponse(
  outboxIds: readonly string[]
) {
  if (outboxIds.length === 0) return;
  runAfterResponse(async () => {
    await getServerScheduledOutboxProcessor()?.processByIds(outboxIds);
  });
}
