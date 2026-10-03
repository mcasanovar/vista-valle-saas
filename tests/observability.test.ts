import { afterEach, describe, expect, it, vi } from "vitest";

import {
  redactObservabilityData,
  setStructuredLogSinkForTests,
  writeStructuredLog,
  type StructuredLogRecord,
} from "@/infrastructure/observability/server";
import {
  captureServerException,
  registerSentryCaptureHook,
} from "@/infrastructure/observability/sentry";
import {
  confirmPayAtPropertyBooking,
  getMockPendingPaymentByReservationId,
  getMockReservationPaymentAdminViewByPublicId,
} from "@/features/reservations/confirm-pay-at-property";
import { getPayAtPropertyCollectionService } from "@/features/payments/pay-at-property-collection";

afterEach(() => {
  registerSentryCaptureHook(null);
  setStructuredLogSinkForTests(null);
  vi.unstubAllEnvs();
});

describe("server observability", () => {
  it("redacts personal data, secrets, errors, and circular values recursively", () => {
    const circular: Record<string, unknown> = {
      reservationId: "reservation-1",
    };
    circular.self = circular;

    expect(
      redactObservabilityData({
        email: "guest@example.test",
        nested: [{ access_token: "provider-secret", phone: "+56 9 123" }],
        problem: Object.assign(new Error("guest@example.test"), {
          code: "PAYMENT_FAILED",
        }),
        circular,
      })
    ).toEqual({
      circular: { reservationId: "reservation-1", self: "[CIRCULAR]" },
      email: "[REDACTED]",
      nested: [{ access_token: "[REDACTED]", phone: "[REDACTED]" }],
      problem: { code: "PAYMENT_FAILED", name: "Error" },
    });
  });

  it("redacts a value by its own shape, not only by its key name (harden-admin-authentication, task 13.4)", () => {
    const jwt =
      "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const bearerHeader = "Bearer sk_live_abcdef1234567890";
    const connectionString =
      "postgresql://vista_valle_user:super-secret-password@db.internal:5432/vista_valle";

    expect(
      redactObservabilityData({
        // Keys the sensitive-key alternation does not recognize - only the
        // value's shape can catch these.
        randomNote: jwt,
        thirdPartyAuthHeader: bearerHeader,
        unlabeledConnection: connectionString,
        // Explicitly inside an array of tuples, not a flat object.
        pairs: [
          ["note", jwt],
          ["other", "not-a-secret"],
        ],
      })
    ).toEqual({
      randomNote: "[REDACTED]",
      thirdPartyAuthHeader: "[REDACTED]",
      unlabeledConnection: "[REDACTED]",
      pairs: [
        ["note", "[REDACTED]"],
        ["other", "not-a-secret"],
      ],
    });
  });

  it("keeps reservation/payment correlation while excluding guest data from structured logs", async () => {
    const logs: StructuredLogRecord[] = [];
    setStructuredLogSinkForTests((record) => logs.push(record));

    const confirmation = await confirmPayAtPropertyBooking({
      checkIn: "2061-01-01",
      checkOut: "2061-01-03",
      email: "guest-observability@example.test",
      firstName: "Guest",
      guestCount: 1,
      lastName: "Private",
      phone: "+56 9 1111 2222",
      room: "demo-room-valle",
    });
    const reservation = await getMockReservationPaymentAdminViewByPublicId(
      confirmation.publicId
    );
    const pending = await getMockPendingPaymentByReservationId(reservation!.id);
    await getPayAtPropertyCollectionService()!.collect(
      {
        amountClp: reservation!.totalClp,
        collectedOn: "2061-01-01",
        medium: "cash",
        reservationId: reservation!.id,
      },
      "admin-observability"
    );

    expect(logs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          context: expect.objectContaining({
            paymentId: pending!.payment.id,
            reservationId: reservation!.id,
          }),
          event: "reservation.confirmed",
        }),
        expect.objectContaining({
          context: expect.objectContaining({
            paymentId: pending!.payment.id,
            reservationId: reservation!.id,
          }),
          event: "payment.collected",
        }),
      ])
    );
    expect(JSON.stringify(logs)).not.toMatch(
      /guest-observability|\+56 9 1111|Guest|Private/
    );
  });

  it("does not invoke Sentry outside an explicitly configured production hook", async () => {
    const capture = vi.fn();
    registerSentryCaptureHook(capture);
    vi.stubEnv("VISTA_VALLE_CONFIG_CONTEXT", "mock");
    vi.stubEnv("SENTRY_DSN", "https://public@example.invalid/1");

    await expect(
      captureServerException("payment.collection_failed", new Error("secret"), {
        email: "guest@example.test",
        paymentId: "payment-1",
        reservationId: "reservation-1",
      })
    ).resolves.toBe(false);
    expect(capture).not.toHaveBeenCalled();
  });

  it("passes only redacted payloads to an explicitly configured Sentry hook", async () => {
    const capture = vi.fn();
    registerSentryCaptureHook(capture);
    vi.stubEnv("VISTA_VALLE_CONFIG_CONTEXT", "production");
    vi.stubEnv("SENTRY_DSN", "https://public@example.invalid/1");

    await expect(
      captureServerException(
        "reservation.confirmation_failed",
        new Error("guest@example.test"),
        {
          reservationId: "reservation-1",
          token: "must-not-leave-the-process",
        }
      )
    ).resolves.toBe(true);
    expect(capture).toHaveBeenCalledWith(
      { name: "Error", code: undefined },
      { reservationId: "reservation-1", token: "[REDACTED]" }
    );
  });

  it("redacts arbitrary log context before writing the structured record", () => {
    const logs: StructuredLogRecord[] = [];
    setStructuredLogSinkForTests((record) => logs.push(record));

    writeStructuredLog("info", "reservation.confirmed", {
      paymentId: "payment-1",
      reservationId: "reservation-1",
      webhookSecret: "provider-secret",
    });

    expect(logs[0]).toMatchObject({
      context: {
        paymentId: "payment-1",
        reservationId: "reservation-1",
        webhookSecret: "[REDACTED]",
      },
      event: "reservation.confirmed",
      level: "info",
    });
  });
});
