import "server-only";

import {
  getMockNotificationOutboxRepository,
  type NotificationOutboxIntent,
} from "@/features/notifications";

export type NotificationDeliveryStatus = Readonly<{
  attempts: number;
  errorCode?: string;
  nextAttemptAt?: Date;
  status: "failed" | "retrying";
}>;

/** Safe admin read-model: deliberately omits recipients, reservation IDs and payloads. */
export function mapNotificationDeliveryStatuses(
  intents: readonly NotificationOutboxIntent[]
) {
  return Object.freeze(
    intents
      .filter(
        (intent): intent is typeof intent & { status: "failed" | "retrying" } =>
          intent.status === "failed" || intent.status === "retrying"
      )
      .map((intent) =>
        Object.freeze({
          attempts: intent.attempts,
          errorCode: intent.lastErrorCode,
          nextAttemptAt: intent.nextAttemptAt,
          status: intent.status,
        })
      )
  );
}

export function getNotificationDeliveryStatuses() {
  const outbox = getMockNotificationOutboxRepository();
  return outbox ? mapNotificationDeliveryStatuses(outbox.list()) : null;
}
