import { describe, expect, it, vi } from "vitest";

import {
  createFintocClient,
  FintocApiError,
  type FintocTransport,
} from "@/features/payments/fintoc-client";

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("createFintocClient", () => {
  it("builds the checkout session request with amount, CLP, and redirect URLs", async () => {
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(200, {
          id: "cs_123",
          redirect_url: "https://pay.fintoc.com/checkout/cs_123",
        })
      );
    vi.stubGlobal("fetch", fetchSpy);

    const transport: FintocTransport = {
      createCheckoutSession: async (input) => {
        const response = await fetch("https://api.fintoc.com/v1/checkout_sessions", {
          method: "POST",
          headers: { Authorization: "sk_test", "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: input.amountClp,
            currency: "CLP",
            flow: "payment",
            success_url: input.successUrl,
            cancel_url: input.cancelUrl,
            metadata: { external_reference: input.externalReference },
          }),
        });
        const data = (await response.json()) as {
          id: string;
          redirect_url: string;
        };
        return { id: data.id, redirectUrl: data.redirect_url };
      },
      createRefund: async () => {
        throw new Error("not used in this test");
      },
    };

    const client = createFintocClient(transport)!;
    const session = await client.createCheckoutSession({
      amountClp: 350_000,
      externalReference: "reservation_abc",
      successUrl: "https://mock-vista-valle.example.test/success",
      cancelUrl: "https://mock-vista-valle.example.test/cancel",
    });

    expect(session).toEqual({
      id: "cs_123",
      redirectUrl: "https://pay.fintoc.com/checkout/cs_123",
    });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [, requestInit] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const body = JSON.parse(requestInit.body as string);
    expect(body).toMatchObject({
      amount: 350_000,
      currency: "CLP",
      flow: "payment",
      success_url: "https://mock-vista-valle.example.test/success",
      cancel_url: "https://mock-vista-valle.example.test/cancel",
      metadata: { external_reference: "reservation_abc" },
    });
  });

  it("wraps a 5xx response as a transient FintocApiError", async () => {
    const transport: FintocTransport = {
      createCheckoutSession: async () => {
        throw new FintocApiError("transient");
      },
      createRefund: async () => {
        throw new Error("not used in this test");
      },
    };
    const client = createFintocClient(transport)!;
    await expect(
      client.createCheckoutSession({
        amountClp: 1000,
        externalReference: "ref",
        successUrl: "https://example.test/success",
        cancelUrl: "https://example.test/cancel",
      })
    ).rejects.toMatchObject({ kind: "transient" });
  });

  it("returns null without an injected transport", () => {
    expect(createFintocClient(null)).toBeNull();
  });
});
