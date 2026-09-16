import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { PaymentMethodsSettings } from "@/features/admin/payment-methods-settings";

describe("PaymentMethodsSettings", () => {
  it("loads and displays the current settings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          payAtPropertyEnabled: true,
          payOnlineEnabled: false,
          payByCardEnabled: true,
        }),
      })
    );

    render(<PaymentMethodsSettings />);

    expect(
      await screen.findByLabelText("Habilitar pagar al llegar")
    ).toBeChecked();
    expect(
      screen.getByLabelText("Habilitar transferencia bancaria")
    ).not.toBeChecked();
    expect(screen.getByLabelText("Habilitar pago con tarjeta")).toBeChecked();
  });

  it("saves immediately when a toggle changes, including turning all three off", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        payAtPropertyEnabled: true,
        payOnlineEnabled: true,
        payByCardEnabled: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PaymentMethodsSettings />);
    const payOnline = await screen.findByLabelText(
      "Habilitar transferencia bancaria"
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        payAtPropertyEnabled: true,
        payOnlineEnabled: true,
        payByCardEnabled: true,
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        payAtPropertyEnabled: true,
        payOnlineEnabled: false,
        payByCardEnabled: true,
      }),
    });

    await userEvent.setup().click(payOnline);

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "/api/admin/payment-methods",
        expect.objectContaining({
          body: JSON.stringify({
            payAtPropertyEnabled: true,
            payOnlineEnabled: false,
            payByCardEnabled: true,
          }),
          method: "PUT",
        })
      )
    );
    expect(await screen.findByText("Guardado")).toBeVisible();
  });
});
