import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

import {
  createLodgingInterval,
  createMockRoomLockGateway,
  type MockRoomLockOperationContext,
} from "@/features/availability";
import {
  createMockGuestRepository,
  createMockHoldRepository,
  createMockReservationRepository,
} from "@/features/reservations";
import { createMockFintocPaymentRepository } from "@/features/payments/fintoc-payment-repository";
import { createMockMercadoPagoClient } from "@/features/payments/mercado-pago-client";
import { createMercadoPagoOnlinePaymentProvider } from "@/features/payments/mercado-pago-provider";
import {
  initiateOnlinePaymentCheckout,
  OnlinePaymentCheckoutUnavailableError,
} from "@/features/payments/online-payment-checkout";
import { processOnlinePaymentWebhookEvent } from "@/features/payments/online-payment-webhook";
import { listPaymentChargebackAlerts } from "@/features/payments/chargeback-alert";

const SECRET = "mp_webhook_test_secret";

const ROOM_A = Object.freeze({ capacity: 2, id: "room-a", nightlyPriceClp: 60_000 });
const ROOM_B = Object.freeze({ capacity: 2, id: "room-b", nightlyPriceClp: 40_000 });

const validGuestCandidate = Object.freeze({
  email: "ana@example.com",
  firstName: "Ana",
  guestCount: 2,
  lastName: "Perez",
  phone: "+56 9 1234 5678",
});

function setUp() {
  const roomLockGateway = createMockRoomLockGateway();
  const guestRepository =
    createMockGuestRepository<MockRoomLockOperationContext>();
  const holdRepository = createMockHoldRepository();
  const reservationRepository = createMockReservationRepository();
  const paymentRepository = createMockFintocPaymentRepository();
  const mercadoPagoClient = createMockMercadoPagoClient();
  const provider = createMercadoPagoOnlinePaymentProvider(
    mercadoPagoClient,
    SECRET
  );

  return {
    holdRepository,
    guestRepository,
    mercadoPagoClient,
    paymentRepository,
    provider,
    reservationRepository,
    roomLockGateway,
  };
}

function signedWebhookHeader(dataId: string, ts: string, secret = SECRET) {
  const manifest = `id:${dataId};ts:${ts};`;
  const signature = createHmac("sha256", secret)
    .update(manifest, "utf8")
    .digest("hex");
  return `ts=${ts},v1=${signature}`;
}

function webhookRequest(dataId: string, secret = SECRET) {
  const ts = "1700000000000";
  return {
    body: JSON.stringify({ type: "payment", data: { id: dataId } }),
    headers: new Headers({
      "x-signature": signedWebhookHeader(dataId, ts, secret),
    }),
    url: "https://vistavallehospedaje.com/api/webhooks/mercadopago",
  };
}

async function initiate(
  setup: ReturnType<typeof setUp>,
  rooms: readonly (typeof ROOM_A | typeof ROOM_B)[] = [ROOM_A]
) {
  const interval = createLodgingInterval("2024-05-05", "2024-05-08");
  return initiateOnlinePaymentCheckout({
    cancelUrl: "https://mock-vista-valle.example.test/cancel",
    guestCandidate: validGuestCandidate,
    guestRepository: setup.guestRepository,
    holdDurationMinutes: 15,
    holdRepository: setup.holdRepository,
    interval,
    paymentRepository: setup.paymentRepository,
    provider: setup.provider,
    rooms,
    roomLockGateway: setup.roomLockGateway,
    successUrl: "https://mock-vista-valle.example.test/success",
  });
}

describe("initiateOnlinePaymentCheckout (Mercado Pago)", () => {
  it("creates a hold with all selected rooms, a Checkout Pro preference, and a single pending payment for the total", async () => {
    const setup = setUp();
    const result = await initiate(setup, [ROOM_A, ROOM_B]);

    expect(result.hold.items).toHaveLength(2);
    expect(result.hold.totalClp).toBe(3 * 60_000 + 3 * 40_000);
    expect(result.redirectUrl).toContain("mercadopago.cl");

    const payment = await setup.paymentRepository.getPaymentByExternalReference(
      result.hold.id
    );
    expect(payment).not.toBeNull();
    expect(payment?.holdId).toBe(result.hold.id);
    expect(payment?.status).toBe("pending");
    expect(payment?.provider).toBe("mercado_pago");
    expect(payment?.amountClp).toBe(result.hold.totalClp);
  });

  it("wraps a Mercado Pago API failure without confirming any payment", async () => {
    const setup = setUp();
    const failingClient = createMockMercadoPagoClient({
      createPreference: async () => {
        throw new Error("network down");
      },
    });
    const provider = createMercadoPagoOnlinePaymentProvider(failingClient, SECRET);
    const interval = createLodgingInterval("2024-05-05", "2024-05-08");

    await expect(
      initiateOnlinePaymentCheckout({
        cancelUrl: "https://mock-vista-valle.example.test/cancel",
        guestCandidate: validGuestCandidate,
        guestRepository: setup.guestRepository,
        holdDurationMinutes: 15,
        holdRepository: setup.holdRepository,
        interval,
        paymentRepository: setup.paymentRepository,
        provider,
        rooms: [ROOM_A],
        roomLockGateway: setup.roomLockGateway,
        successUrl: "https://mock-vista-valle.example.test/success",
      })
    ).rejects.toBeInstanceOf(OnlinePaymentCheckoutUnavailableError);
  });
});

describe("mercado-pago webhook processing", () => {
  it("rejects a notification with an invalid signature without querying the payment", async () => {
    const setup = setUp();
    await expect(
      setup.provider.parseAndVerifyWebhookEvent(webhookRequest("pay_1", "wrong-secret"))
    ).rejects.toThrow();
  });

  it("confirms the reservation and approves the payment when Mercado Pago reports it approved", async () => {
    const setup = setUp();
    const { hold } = await initiate(setup);
    const payment = (await setup.paymentRepository.getPaymentByExternalReference(
      hold.id
    ))!;

    setup.mercadoPagoClient.seedPayment({
      id: "pay_1",
      status: "approved",
      externalReference: payment.externalReference,
    });

    const event = (await setup.provider.parseAndVerifyWebhookEvent(
      webhookRequest("pay_1")
    ))!;
    const result = await processOnlinePaymentWebhookEvent({
      event,
      paymentProvider: "mercado_pago",
      paymentRepository: setup.paymentRepository,
      holdRepository: setup.holdRepository,
      reservationRepository: setup.reservationRepository,
      roomLockGateway: setup.roomLockGateway,
    });

    expect(result).toEqual({ outcome: "reservation_confirmed" });
    await expect(setup.holdRepository.getHoldById(hold.id)).resolves.toBeNull();
    const reservations = await setup.reservationRepository.listReservations!();
    expect(reservations).toHaveLength(1);
    expect(reservations[0]!.paymentMode).toBe("pay_now");
  });

  it("marks the payment rejected and releases the hold when Mercado Pago reports it rejected", async () => {
    const setup = setUp();
    const { hold } = await initiate(setup);
    const payment = (await setup.paymentRepository.getPaymentByExternalReference(
      hold.id
    ))!;

    setup.mercadoPagoClient.seedPayment({
      id: "pay_2",
      status: "rejected",
      externalReference: payment.externalReference,
    });

    const event = (await setup.provider.parseAndVerifyWebhookEvent(
      webhookRequest("pay_2")
    ))!;
    const result = await processOnlinePaymentWebhookEvent({
      event,
      paymentProvider: "mercado_pago",
      paymentRepository: setup.paymentRepository,
      holdRepository: setup.holdRepository,
      reservationRepository: setup.reservationRepository,
      roomLockGateway: setup.roomLockGateway,
    });

    expect(result).toEqual({ outcome: "payment_failed" });
    await expect(setup.holdRepository.getHoldById(hold.id)).resolves.toBeNull();
    const updated = await setup.paymentRepository.getPaymentById(payment.id);
    expect(updated?.status).toBe("rejected");
  });

  it("leaves the payment transitional when Mercado Pago reports it in_process", async () => {
    const setup = setUp();
    const { hold } = await initiate(setup);
    const payment = (await setup.paymentRepository.getPaymentByExternalReference(
      hold.id
    ))!;

    setup.mercadoPagoClient.seedPayment({
      id: "pay_3",
      status: "in_process",
      externalReference: payment.externalReference,
    });

    const event = (await setup.provider.parseAndVerifyWebhookEvent(
      webhookRequest("pay_3")
    ))!;
    const result = await processOnlinePaymentWebhookEvent({
      event,
      paymentProvider: "mercado_pago",
      paymentRepository: setup.paymentRepository,
      holdRepository: setup.holdRepository,
      reservationRepository: setup.reservationRepository,
      roomLockGateway: setup.roomLockGateway,
    });

    expect(result).toEqual({ outcome: "requires_action" });
    await expect(setup.holdRepository.getHoldById(hold.id)).resolves.not.toBeNull();
  });

  it("marks a charged_back payment, alerts, and does not touch the confirmed reservation", async () => {
    const setup = setUp();
    const { hold } = await initiate(setup);
    const payment = (await setup.paymentRepository.getPaymentByExternalReference(
      hold.id
    ))!;

    setup.mercadoPagoClient.seedPayment({
      id: "pay_4",
      status: "approved",
      externalReference: payment.externalReference,
    });
    const approvedEvent = (await setup.provider.parseAndVerifyWebhookEvent(
      webhookRequest("pay_4")
    ))!;
    const confirmed = await processOnlinePaymentWebhookEvent({
      event: approvedEvent,
      paymentProvider: "mercado_pago",
      paymentRepository: setup.paymentRepository,
      holdRepository: setup.holdRepository,
      reservationRepository: setup.reservationRepository,
      roomLockGateway: setup.roomLockGateway,
    });
    expect(confirmed).toEqual({ outcome: "reservation_confirmed" });

    const alertsBefore = (await listPaymentChargebackAlerts()).length;

    setup.mercadoPagoClient.seedPayment({
      id: "pay_4",
      status: "charged_back",
      externalReference: payment.externalReference,
    });
    const chargebackEvent = (await setup.provider.parseAndVerifyWebhookEvent(
      webhookRequest("pay_4")
    ))!;
    const result = await processOnlinePaymentWebhookEvent({
      event: chargebackEvent,
      paymentProvider: "mercado_pago",
      paymentRepository: setup.paymentRepository,
      holdRepository: setup.holdRepository,
      reservationRepository: setup.reservationRepository,
      roomLockGateway: setup.roomLockGateway,
    });

    expect(result).toEqual({ outcome: "charged_back" });
    const alerts = await listPaymentChargebackAlerts();
    expect(alerts.length).toBe(alertsBefore + 1);

    const updatedPayment = await setup.paymentRepository.getPaymentById(payment.id);
    expect(updatedPayment?.status).toBe("charged_back");
    const reservations = await setup.reservationRepository.listReservations!();
    expect(reservations).toHaveLength(1);
    expect(reservations[0]!.status).toBe("confirmed");
  });

  it("does not reprocess a redelivered notification for the same payment id and status", async () => {
    const setup = setUp();
    const { hold } = await initiate(setup);
    const payment = (await setup.paymentRepository.getPaymentByExternalReference(
      hold.id
    ))!;

    setup.mercadoPagoClient.seedPayment({
      id: "pay_5",
      status: "approved",
      externalReference: payment.externalReference,
    });

    const firstEvent = (await setup.provider.parseAndVerifyWebhookEvent(
      webhookRequest("pay_5")
    ))!;
    const secondEvent = (await setup.provider.parseAndVerifyWebhookEvent(
      webhookRequest("pay_5")
    ))!;
    expect(firstEvent.id).toBe(secondEvent.id);

    const firstRecord = await setup.paymentRepository.recordWebhookEvent({
      eventType: firstEvent.type,
      occurredAt: firstEvent.occurredAt,
      payload: firstEvent.payload,
      paymentId: null,
      provider: "mercado_pago",
      providerEventId: firstEvent.id,
    });
    expect(firstRecord.alreadyProcessed).toBe(false);

    const secondRecord = await setup.paymentRepository.recordWebhookEvent({
      eventType: secondEvent.type,
      occurredAt: secondEvent.occurredAt,
      payload: secondEvent.payload,
      paymentId: null,
      provider: "mercado_pago",
      providerEventId: secondEvent.id,
    });
    expect(secondRecord.alreadyProcessed).toBe(true);
  });

  it("acknowledges an unhandled topic without querying the payment", async () => {
    const setup = setUp();
    const ts = "1700000000000";
    const event = await setup.provider.parseAndVerifyWebhookEvent({
      body: JSON.stringify({ type: "merchant_order", data: { id: "mo_1" } }),
      headers: new Headers({
        "x-signature": signedWebhookHeader("mo_1", ts),
      }),
      url: "https://vistavallehospedaje.com/api/webhooks/mercadopago",
    });
    expect(event).toBeNull();
  });
});
