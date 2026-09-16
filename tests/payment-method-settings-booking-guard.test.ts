import { afterEach, describe, expect, it } from "vitest";

import { POST as payAtPropertyPOST } from "../app/api/bookings/pay-at-property/route";
import { POST as fintocCheckoutPOST } from "../app/api/bookings/fintoc-checkout/route";
import { POST as mercadoPagoCheckoutPOST } from "../app/api/bookings/mercadopago-checkout/route";
import { getPaymentMethodSettingsRepository } from "@/features/payments";

const booking = {
  checkIn: "2027-03-10",
  checkOut: "2027-03-13",
  email: "ana@example.com",
  firstName: "Ana",
  guestCount: "1",
  lastName: "Pérez",
  phone: "+56 9 1111 1111",
  room: "habitacion-valle-demo",
  totalClp: "1",
};

function payAtPropertyRequest(idempotencyKey: string) {
  return new Request("http://localhost/api/bookings/pay-at-property", {
    body: JSON.stringify(booking),
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": idempotencyKey,
    },
    method: "POST",
  });
}

function onlineCheckoutRequest(path: string) {
  return new Request(`http://localhost${path}`, {
    body: JSON.stringify({ ...booking, guests: "1" }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
}

describe("payment method toggle guards booking confirmation endpoints", () => {
  afterEach(async () => {
    await getPaymentMethodSettingsRepository("mock")!.update({
      payAtPropertyEnabled: true,
      payOnlineEnabled: true,
      payByCardEnabled: true,
    });
  });

  it("rejects pay-at-property confirmation when the admin disabled it", async () => {
    await getPaymentMethodSettingsRepository("mock")!.update({
      payAtPropertyEnabled: false,
      payOnlineEnabled: true,
      payByCardEnabled: true,
    });

    const response = await payAtPropertyPOST(
      payAtPropertyRequest("booking-guard-11111111-1111-1111-1111-111111111111")
    );

    expect(response.status).toBe(503);
  });

  it("rejects Fintoc checkout when the admin disabled la transferencia bancaria", async () => {
    await getPaymentMethodSettingsRepository("mock")!.update({
      payAtPropertyEnabled: true,
      payOnlineEnabled: false,
      payByCardEnabled: true,
    });

    const response = await fintocCheckoutPOST(
      onlineCheckoutRequest("/api/bookings/fintoc-checkout")
    );

    expect(response.status).toBe(503);
  });

  it("rejects Mercado Pago checkout when the admin disabled el pago con tarjeta", async () => {
    await getPaymentMethodSettingsRepository("mock")!.update({
      payAtPropertyEnabled: true,
      payOnlineEnabled: true,
      payByCardEnabled: false,
    });

    const response = await mercadoPagoCheckoutPOST(
      onlineCheckoutRequest("/api/bookings/mercadopago-checkout")
    );

    expect(response.status).toBe(503);
  });
});
