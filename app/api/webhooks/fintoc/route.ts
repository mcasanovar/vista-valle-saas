import { getServerEnvironment } from "@/config/server";
import { createDatabaseBoundary } from "@/infrastructure/database/server";
import {
  captureServerException,
  writeStructuredLog,
} from "@/infrastructure/observability/sentry";
import {
  FintocWebhookSignatureError,
  verifyFintocWebhookSignature,
} from "@/features/payments/fintoc-webhook-signature";
import { parseFintocWebhookEvent } from "@/features/payments/fintoc-webhook-parser";
import {
  processFintocWebhookEvent,
  type ProcessFintocWebhookEventParams,
} from "@/features/payments/fintoc-webhook";
import {
  getMockFintocOnlinePaymentDependencies,
  getProductionFintocOnlinePaymentDependencies,
} from "@/features/payments/fintoc-dependencies";
import { HoldExpiredError } from "@/features/reservations/confirm-pay-now-reservation";
import { raiseConflictAlertForExpiredHold } from "@/features/channel-calendar-sync/hold-expiry-alert";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const environment = getServerEnvironment();

  try {
    verifyFintocWebhookSignature(
      rawBody,
      request.headers.get("Fintoc-Signature"),
      environment.FINTOC_WEBHOOK_SECRET
    );
  } catch (error) {
    if (error instanceof FintocWebhookSignatureError) {
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }
    throw error;
  }

  const rawEvent = JSON.parse(rawBody) as unknown;
  const event = parseFintocWebhookEvent(rawEvent);
  if (!event) {
    // An event type or shape this handler does not act on; acknowledge so Fintoc does not retry.
    return Response.json({ received: true }, { status: 200 });
  }

  const boundary = createDatabaseBoundary();

  try {
    const outcome =
      boundary.context !== "production"
        ? await handleEvent(event, getMockFintocOnlinePaymentDependencies())
        : await handleEvent(event, getProductionFintocOnlinePaymentDependencies());
    if (outcome === "already_processed") {
      return Response.json({ received: true }, { status: 200 });
    }
    writeStructuredLog("info", "fintoc_webhook.processed", {
      eventId: event.id,
      eventType: event.type,
      outcome,
    });
    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    await captureServerException("fintoc_webhook.processing_failed", error, {
      eventId: event.id,
      eventType: event.type,
    });
    const dependencies =
      boundary.context !== "production"
        ? getMockFintocOnlinePaymentDependencies()
        : getProductionFintocOnlinePaymentDependencies();
    if (error instanceof HoldExpiredError) {
      // A channel-sync arrival may have occupied this room during the
      // hold's expiry window before this (now-late) approval arrived (see
      // `channel-calendar-sync` spec: "Alerta de conflicto por vencimiento
      // de retención durante sincronización") — distinct from every other
      // error this handler catches generically above.
      await raiseConflictAlertForExpiredHold(
        error.holdId,
        dependencies.holdRepository
      );
    }
    await dependencies.fintocPaymentRepository.discardWebhookEvent(event.id);
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

/**
 * Generic over `TContext` so it type-checks against either dependency bag
 * without TypeScript having to correlate a union of two full bags (see
 * `fintoc-checkout-service.ts` for the same pattern and why).
 */
async function handleEvent<TContext>(
  event: NonNullable<ReturnType<typeof parseFintocWebhookEvent>>,
  dependencies: Omit<ProcessFintocWebhookEventParams<TContext>, "event">
) {
  const { alreadyProcessed } =
    await dependencies.fintocPaymentRepository.recordWebhookEvent({
      eventType: event.type,
      occurredAt: event.occurredAt,
      payload: event.payload,
      paymentId: null,
      providerEventId: event.id,
    });
  if (alreadyProcessed) return "already_processed" as const;

  const result = await processFintocWebhookEvent<TContext>({
    event,
    fintocPaymentRepository: dependencies.fintocPaymentRepository,
    holdRepository: dependencies.holdRepository,
    reservationRepository: dependencies.reservationRepository,
    roomLockGateway: dependencies.roomLockGateway,
  });
  return result.outcome;
}
