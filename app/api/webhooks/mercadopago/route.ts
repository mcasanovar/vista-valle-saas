import { createDatabaseBoundary } from "@/infrastructure/database/server";
import {
  captureServerException,
  writeStructuredLog,
} from "@/infrastructure/observability/sentry";
import { getMercadoPagoOnlinePaymentProvider } from "@/features/payments/mercado-pago-provider";
import { InvalidWebhookSignatureError } from "@/features/payments/online-payment-provider";
import {
  processOnlinePaymentWebhookEvent,
  type ProcessOnlinePaymentWebhookEventParams,
} from "@/features/payments/online-payment-webhook";
import {
  getMockMercadoPagoOnlinePaymentDependencies,
  getProductionMercadoPagoOnlinePaymentDependencies,
} from "@/features/payments/mercado-pago-dependencies";
import { HoldExpiredError } from "@/features/reservations/confirm-pay-now-reservation";
import { raiseConflictAlertForExpiredHold } from "@/features/channel-calendar-sync/hold-expiry-alert";

export async function POST(request: Request) {
  const rawBody = await request.text();
  const boundary = createDatabaseBoundary();
  const isProduction = boundary.context === "production";

  // Any dependency bag exposes the same client/credentials regardless of
  // context, so the provider (needed before we know which bag we'll use
  // to process the event) can be built from whichever one we construct
  // first.
  const clientDependencies = isProduction
    ? getProductionMercadoPagoOnlinePaymentDependencies()
    : getMockMercadoPagoOnlinePaymentDependencies();
  const provider = getMercadoPagoOnlinePaymentProvider(
    clientDependencies.mercadoPagoClient
  );

  let event;
  try {
    event = await provider.parseAndVerifyWebhookEvent({
      body: rawBody,
      headers: request.headers,
      url: request.url,
    });
  } catch (error) {
    if (error instanceof InvalidWebhookSignatureError) {
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }
    throw error;
  }

  if (!event) {
    // A topic or payload this handler does not act on; acknowledge so Mercado Pago does not retry.
    return Response.json({ received: true }, { status: 200 });
  }

  try {
    const outcome = isProduction
      ? await handleEvent(event, getProductionMercadoPagoOnlinePaymentDependencies())
      : await handleEvent(event, getMockMercadoPagoOnlinePaymentDependencies());
    if (outcome === "already_processed") {
      return Response.json({ received: true }, { status: 200 });
    }
    writeStructuredLog("info", "mercado_pago_webhook.processed", {
      eventId: event.id,
      eventType: event.type,
      outcome,
    });
    return Response.json({ received: true }, { status: 200 });
  } catch (error) {
    await captureServerException(
      "mercado_pago_webhook.processing_failed",
      error,
      { eventId: event.id, eventType: event.type }
    );
    const dependencies = isProduction
      ? getProductionMercadoPagoOnlinePaymentDependencies()
      : getMockMercadoPagoOnlinePaymentDependencies();
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
    await dependencies.fintocPaymentRepository.discardWebhookEvent(
      event.id,
      "mercado_pago"
    );
    return Response.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}

/**
 * Generic over `TContext` so it type-checks against either dependency bag
 * without TypeScript having to correlate a union of two full bags (see
 * `app/api/webhooks/fintoc/route.ts` for the same pattern and why).
 */
async function handleEvent<TContext>(
  event: NonNullable<
    Awaited<
      ReturnType<
        ReturnType<typeof getMercadoPagoOnlinePaymentProvider>["parseAndVerifyWebhookEvent"]
      >
    >
  >,
  dependencies: Readonly<{
    fintocPaymentRepository: ProcessOnlinePaymentWebhookEventParams<TContext>["paymentRepository"];
    holdRepository: ProcessOnlinePaymentWebhookEventParams<TContext>["holdRepository"];
    reservationRepository: ProcessOnlinePaymentWebhookEventParams<TContext>["reservationRepository"];
    roomLockGateway: ProcessOnlinePaymentWebhookEventParams<TContext>["roomLockGateway"];
  }>
) {
  const { alreadyProcessed } =
    await dependencies.fintocPaymentRepository.recordWebhookEvent({
      eventType: event.type,
      occurredAt: event.occurredAt,
      payload: event.payload,
      paymentId: null,
      provider: "mercado_pago",
      providerEventId: event.id,
    });
  if (alreadyProcessed) return "already_processed" as const;

  const result = await processOnlinePaymentWebhookEvent<TContext>({
    event,
    paymentProvider: "mercado_pago",
    paymentRepository: dependencies.fintocPaymentRepository,
    holdRepository: dependencies.holdRepository,
    reservationRepository: dependencies.reservationRepository,
    roomLockGateway: dependencies.roomLockGateway,
  });
  return result.outcome;
}
