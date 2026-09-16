import { describe, expect, it, vi } from "vitest";

import {
  createMercadoPagoClient,
  createMockMercadoPagoClient,
  MercadoPagoApiError,
  type MercadoPagoTransport,
} from "@/features/payments/mercado-pago-client";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("createMercadoPagoClient", () => {
  it("builds the preference request with CLP, 1 installment, and date_of_expiration matching the hold", async () => {
    const fetchSpy = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        id: "mp_pref_123",
        init_point: "https://www.mercadopago.cl/checkout/v1/redirect?pref_id=mp_pref_123",
      })
    );
    vi.stubGlobal("fetch", fetchSpy);

    const expiresAt = new Date("2031-02-10T12:00:00.000Z");
    const transport: MercadoPagoTransport = {
      createPreference: async (input) => {
        const response = await fetch(
          "https://api.mercadopago.com/checkout/preferences",
          {
            method: "POST",
            headers: {
              Authorization: "Bearer test-token",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              items: [
                {
                  title: "Reserva Vista Valle",
                  quantity: 1,
                  currency_id: "CLP",
                  unit_price: input.amountClp,
                },
              ],
              back_urls: {
                success: input.successUrl,
                failure: input.cancelUrl,
                pending: input.successUrl,
              },
              auto_return: "approved",
              external_reference: input.externalReference,
              expires: true,
              date_of_expiration: input.expiresAt.toISOString(),
              payment_methods: { installments: 1, default_installments: 1 },
            }),
          }
        );
        const data = (await response.json()) as {
          id: string;
          init_point: string;
        };
        return { id: data.id, initPoint: data.init_point };
      },
      getPayment: async () => {
        throw new Error("not used in this test");
      },
    };

    const client = createMercadoPagoClient(transport)!;
    const preference = await client.createPreference({
      amountClp: 240_000,
      cancelUrl: "https://mock-vista-valle.example.test/cancel",
      expiresAt,
      externalReference: "hold-abc",
      successUrl: "https://mock-vista-valle.example.test/success",
    });

    expect(preference).toEqual({
      id: "mp_pref_123",
      initPoint: "https://www.mercadopago.cl/checkout/v1/redirect?pref_id=mp_pref_123",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestInit.body as string);
    expect(body).toMatchObject({
      items: [
        { currency_id: "CLP", quantity: 1, unit_price: 240_000 },
      ],
      auto_return: "approved",
      external_reference: "hold-abc",
      expires: true,
      date_of_expiration: expiresAt.toISOString(),
      payment_methods: { installments: 1, default_installments: 1 },
    });
  });

  it("wraps a 5xx response as a transient MercadoPagoApiError", async () => {
    const transport: MercadoPagoTransport = {
      createPreference: async () => {
        throw new MercadoPagoApiError("transient");
      },
      getPayment: async () => {
        throw new Error("not used in this test");
      },
    };
    const client = createMercadoPagoClient(transport)!;
    await expect(
      client.createPreference({
        amountClp: 1000,
        cancelUrl: "https://example.test/cancel",
        expiresAt: new Date(),
        externalReference: "ref",
        successUrl: "https://example.test/success",
      })
    ).rejects.toMatchObject({ kind: "transient" });
  });

  it("returns null without an injected transport", () => {
    expect(createMercadoPagoClient(null)).toBeNull();
  });
});

describe("createMockMercadoPagoClient", () => {
  it("records created preferences and returns a seeded payment by id", async () => {
    const client = createMockMercadoPagoClient();
    await client.createPreference({
      amountClp: 100_000,
      cancelUrl: "https://example.test/cancel",
      expiresAt: new Date(),
      externalReference: "hold-1",
      successUrl: "https://example.test/success",
    });

    expect(client.listPreferences()[0]!.externalReference).toBe("hold-1");

    client.seedPayment({ id: "pay_1", status: "approved", externalReference: "hold-1" });
    await expect(client.getPayment("pay_1")).resolves.toEqual({
      id: "pay_1",
      status: "approved",
      externalReference: "hold-1",
    });
  });

  it("throws for an unknown payment id", async () => {
    const client = createMockMercadoPagoClient();
    await expect(client.getPayment("does-not-exist")).rejects.toBeInstanceOf(
      MercadoPagoApiError
    );
  });
});
