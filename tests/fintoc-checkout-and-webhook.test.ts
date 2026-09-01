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
import {
  createMockFintocClient,
  type FintocTransport,
} from "@/features/payments/fintoc-client";
import { createMockFintocPaymentRepository } from "@/features/payments/fintoc-payment-repository";
import {
  FintocCheckoutUnavailableError,
  initiateFintocCheckout,
} from "@/features/payments/fintoc-checkout";
import {
  processFintocWebhookEvent,
  type FintocWebhookEvent,
} from "@/features/payments/fintoc-webhook";

const ROOM = Object.freeze({
  capacity: 2,
  id: "room-a",
  nightlyPriceClp: 60_000,
});

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
  const fintocPaymentRepository = createMockFintocPaymentRepository();
  const fintocClient = createMockFintocClient();

  return {
    fintocClient,
    fintocPaymentRepository,
    guestRepository,
    holdRepository,
    reservationRepository,
    roomLockGateway,
  };
}

function baseWebhookEvent(
  overrides: Partial<FintocWebhookEvent> &
    Pick<FintocWebhookEvent, "checkoutSessionId" | "paymentIntentStatus">
): FintocWebhookEvent {
  return {
    id: `evt_${crypto.randomUUID()}`,
    occurredAt: new Date(),
    paymentIntentId: `pi_${crypto.randomUUID()}`,
    payload: {},
    type: "payment_intent.succeeded",
    ...overrides,
  };
}

describe("initiateFintocCheckout", () => {
  it("creates a hold, a Fintoc checkout session, and a pending payment against the hold", async () => {
    const setup = setUp();
    const interval = createLodgingInterval("2024-05-05", "2024-05-08");

    const result = await initiateFintocCheckout({
      cancelUrl: "https://mock-vista-valle.example.test/cancel",
      fintocClient: setup.fintocClient,
      fintocPaymentRepository: setup.fintocPaymentRepository,
      guestCandidate: validGuestCandidate,
      guestRepository: setup.guestRepository,
      holdDurationMinutes: 15,
      holdRepository: setup.holdRepository,
      interval,
      room: ROOM,
      roomLockGateway: setup.roomLockGateway,
      successUrl: "https://mock-vista-valle.example.test/success",
    });

    expect(result.hold.totalClp).toBe(3 * 60_000);
    expect(result.redirectUrl).toMatch(/^https:\/\/pay\.fintoc\.com\/checkout\//);

    const payment = await setup.fintocPaymentRepository.getPaymentByExternalReference(
      (await setup.fintocClient.listCheckoutSessions())[0]!.id
    );
    expect(payment).not.toBeNull();
    expect(payment?.holdId).toBe(result.hold.id);
    expect(payment?.status).toBe("pending");
    expect(payment?.amountClp).toBe(result.hold.totalClp);
  });

  it("wraps a Fintoc API failure without confirming any payment", async () => {
    const setup = setUp();
    const failingTransport: FintocTransport = {
      createCheckoutSession: async () => {
        throw new Error("network down");
      },
      createRefund: async () => {
        throw new Error("not used");
      },
    };
    const fintocClient = createMockFintocClient(failingTransport);
    const interval = createLodgingInterval("2024-05-05", "2024-05-08");

    await expect(
      initiateFintocCheckout({
        cancelUrl: "https://mock-vista-valle.example.test/cancel",
        fintocClient,
        fintocPaymentRepository: setup.fintocPaymentRepository,
        guestCandidate: validGuestCandidate,
        guestRepository: setup.guestRepository,
        holdDurationMinutes: 15,
        holdRepository: setup.holdRepository,
        interval,
        room: ROOM,
        roomLockGateway: setup.roomLockGateway,
        successUrl: "https://mock-vista-valle.example.test/success",
      })
    ).rejects.toBeInstanceOf(FintocCheckoutUnavailableError);
  });
});

describe("processFintocWebhookEvent", () => {
  async function initiate(setup: ReturnType<typeof setUp>) {
    const interval = createLodgingInterval("2024-05-05", "2024-05-08");
    return initiateFintocCheckout({
      cancelUrl: "https://mock-vista-valle.example.test/cancel",
      fintocClient: setup.fintocClient,
      fintocPaymentRepository: setup.fintocPaymentRepository,
      guestCandidate: validGuestCandidate,
      guestRepository: setup.guestRepository,
      holdDurationMinutes: 15,
      holdRepository: setup.holdRepository,
      interval,
      room: ROOM,
      roomLockGateway: setup.roomLockGateway,
      successUrl: "https://mock-vista-valle.example.test/success",
    });
  }

  it("confirms the reservation and approves the payment on payment_intent.succeeded", async () => {
    const setup = setUp();
    const { hold } = await initiate(setup);
    const payment = (
      await setup.fintocPaymentRepository.getPaymentByExternalReference(
        (await setup.fintocClient.listCheckoutSessions())[0]!.id
      )
    )!;

    const result = await processFintocWebhookEvent({
      event: baseWebhookEvent({
        checkoutSessionId: payment.externalReference,
        paymentIntentStatus: "succeeded",
      }),
      fintocPaymentRepository: setup.fintocPaymentRepository,
      holdRepository: setup.holdRepository,
      reservationRepository: setup.reservationRepository,
      roomLockGateway: setup.roomLockGateway,
    });

    expect(result).toEqual({ outcome: "reservation_confirmed" });
    await expect(setup.holdRepository.getHoldById(hold.id)).resolves.toBeNull();

    const reservations = await setup.reservationRepository.listReservations!();
    expect(reservations).toHaveLength(1);
    expect(reservations[0]!.paymentMode).toBe("pay_now");
    expect(reservations[0]!.status).toBe("confirmed");
  });

  it("marks the payment rejected and releases the hold on payment_intent.failed", async () => {
    const setup = setUp();
    const { hold } = await initiate(setup);
    const payment = (
      await setup.fintocPaymentRepository.getPaymentByExternalReference(
        (await setup.fintocClient.listCheckoutSessions())[0]!.id
      )
    )!;

    const result = await processFintocWebhookEvent({
      event: baseWebhookEvent({
        checkoutSessionId: payment.externalReference,
        paymentIntentStatus: "failed",
      }),
      fintocPaymentRepository: setup.fintocPaymentRepository,
      holdRepository: setup.holdRepository,
      reservationRepository: setup.reservationRepository,
      roomLockGateway: setup.roomLockGateway,
    });

    expect(result).toEqual({ outcome: "payment_failed" });
    await expect(setup.holdRepository.getHoldById(hold.id)).resolves.toBeNull();
    const updated = await setup.fintocPaymentRepository.getPaymentById(
      payment.id
    );
    expect(updated?.status).toBe("rejected");
  });

  it("leaves the payment and hold in a transitional state on payment_intent.requires_action", async () => {
    const setup = setUp();
    const { hold } = await initiate(setup);
    const payment = (
      await setup.fintocPaymentRepository.getPaymentByExternalReference(
        (await setup.fintocClient.listCheckoutSessions())[0]!.id
      )
    )!;

    const result = await processFintocWebhookEvent({
      event: baseWebhookEvent({
        checkoutSessionId: payment.externalReference,
        paymentIntentStatus: "requires_action",
      }),
      fintocPaymentRepository: setup.fintocPaymentRepository,
      holdRepository: setup.holdRepository,
      reservationRepository: setup.reservationRepository,
      roomLockGateway: setup.roomLockGateway,
    });

    expect(result).toEqual({ outcome: "requires_action" });
    await expect(setup.holdRepository.getHoldById(hold.id)).resolves.not.toBeNull();
    const updated = await setup.fintocPaymentRepository.getPaymentById(
      payment.id
    );
    expect(updated?.status).toBe("requires_action");
  });

  it("ignores an event for an unknown checkout session", async () => {
    const setup = setUp();

    const result = await processFintocWebhookEvent({
      event: baseWebhookEvent({
        checkoutSessionId: "cs_unknown",
        paymentIntentStatus: "succeeded",
      }),
      fintocPaymentRepository: setup.fintocPaymentRepository,
      holdRepository: setup.holdRepository,
      reservationRepository: setup.reservationRepository,
      roomLockGateway: setup.roomLockGateway,
    });

    expect(result).toEqual({ outcome: "payment_not_found" });
  });

  it("ignores a duplicate event once the payment already reached a final state", async () => {
    const setup = setUp();
    const { } = await initiate(setup);
    const payment = (
      await setup.fintocPaymentRepository.getPaymentByExternalReference(
        (await setup.fintocClient.listCheckoutSessions())[0]!.id
      )
    )!;

    await processFintocWebhookEvent({
      event: baseWebhookEvent({
        checkoutSessionId: payment.externalReference,
        paymentIntentStatus: "succeeded",
      }),
      fintocPaymentRepository: setup.fintocPaymentRepository,
      holdRepository: setup.holdRepository,
      reservationRepository: setup.reservationRepository,
      roomLockGateway: setup.roomLockGateway,
    });

    const result = await processFintocWebhookEvent({
      event: baseWebhookEvent({
        checkoutSessionId: payment.externalReference,
        paymentIntentStatus: "succeeded",
      }),
      fintocPaymentRepository: setup.fintocPaymentRepository,
      holdRepository: setup.holdRepository,
      reservationRepository: setup.reservationRepository,
      roomLockGateway: setup.roomLockGateway,
    });

    expect(result).toEqual({ outcome: "ignored_duplicate" });
  });
});
