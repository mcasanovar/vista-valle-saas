import { describe, expect, it } from "vitest";

import { POST } from "../app/api/bookings/pay-at-property/route";
import {
  BookingConfirmationUnavailableError,
  createPayAtPropertyBookingConfirmationService,
  getPublicBookingConfirmation,
} from "@/features/reservations/confirm-pay-at-property";
import {
  createMockBookingIdempotencyStore,
  ReusedBookingIdempotencyKeyError,
} from "@/features/reservations/booking-idempotency";

const booking = {
  checkIn: "2027-01-10",
  checkOut: "2027-01-13",
  email: "ana@example.com",
  firstName: "Ana",
  guestCount: "1",
  lastName: "Pérez",
  phone: "+56 9 1111 1111",
  room: "habitacion-valle-demo",
  totalClp: "1",
};

function request(
  body: Record<string, unknown>,
  idempotencyKey = "booking-12345678-1234-1234-1234-123456789abc"
) {
  return new Request("http://localhost/api/bookings/pay-at-property", {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    method: "POST",
  });
}

describe("PAY_AT_PROPERTY booking confirmation", () => {
  it("confirms a multi-room invoice request with an aggregate total and rejects invalid invoice RUT", async () => {
    const multi = {
      ...booking,
      checkIn: "2030-01-10",
      checkOut: "2030-01-13",
      rooms: "habitacion-valle-demo,habitacion-andes-demo",
      invoiceRequested: "true",
      invoiceName: "Empresa",
      invoiceRut: "76.000.543-6",
      invoicePhone: "123",
      invoiceBusinessActivity: "Giro",
      invoiceEmail: "facturas@example.test",
    };
    const ok = await POST(
      request(multi, "booking-11111111-1111-1111-1111-111111111111")
    );
    expect(ok.status).toBe(201);
    expect(await ok.json()).toMatchObject({
      paymentMode: "PAY_AT_PROPERTY",
      totalClp: expect.any(Number),
    });
    const invalid = await POST(
      request(
        { ...multi, invoiceRut: "76.000.543-2" },
        "booking-22222222-2222-2222-2222-222222222222"
      )
    );
    expect(invalid.status).toBe(400);
    await expect(invalid.json()).resolves.toEqual({
      message: "Revisa las fechas y datos del huésped antes de confirmar.",
    });
  });
  it("replays a completed POST with the same key instead of creating another reservation", async () => {
    const response = await POST(request(booking));
    const body = (await response.json()) as {
      paymentMode: string;
      publicId: string;
      totalClp: number;
      guest: { firstName: string; email?: string };
    };

    expect(response.status).toBe(201);
    expect(body).toMatchObject({
      paymentMode: "PAY_AT_PROPERTY",
      totalClp: 165000,
      guest: { firstName: "Ana" },
    });
    expect(body.publicId).toMatch(/^VV-[0-9a-f-]{36}$/);
    expect(body.guest.email).toBeUndefined();
    await expect(
      getPublicBookingConfirmation(body.publicId)
    ).resolves.toMatchObject({
      publicId: body.publicId,
      totalClp: 165000,
    });
    const replay = await POST(
      request({ ...booking, paymentMode: "pay_now", totalClp: "1" })
    );
    expect(replay.status).toBe(201);
    await expect(replay.json()).resolves.toMatchObject({
      publicId: body.publicId,
    });
  });

  it("rejects a reused key with changed booking data and preserves the final lock revalidation", async () => {
    const changed = await POST(request({ ...booking, checkOut: "2027-01-14" }));
    expect(changed.status).toBe(400);

    const response = await POST(
      request(booking, "booking-87654321-4321-4321-4321-cba987654321")
    );
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      message: "La habitación ya no está disponible para esas fechas.",
    });
  });

  it("fails closed instead of selecting mock persistence in production", () => {
    expect(() =>
      createPayAtPropertyBookingConfirmationService("production")
    ).toThrow(BookingConfirmationUnavailableError);
  });

  it("does not cache a failed operation and rejects only key/payload mismatches", async () => {
    const store = createMockBookingIdempotencyStore<string>();
    const key = "booking-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
    let attempts = 0;

    await expect(
      store.execute(key, "fingerprint", async () => {
        attempts += 1;
        throw new Error("late conflict");
      })
    ).rejects.toThrow("late conflict");
    await expect(
      store.execute(key, "fingerprint", async () => {
        attempts += 1;
        return "confirmed";
      })
    ).resolves.toBe("confirmed");
    expect(attempts).toBe(2);
    expect(() => store.execute(key, "other", async () => "unexpected")).toThrow(
      ReusedBookingIdempotencyKeyError
    );
  });
});
