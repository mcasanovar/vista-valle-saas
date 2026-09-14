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
        }),
      })
    );

    render(<PaymentMethodsSettings />);

    expect(
      await screen.findByLabelText("Habilitar pagar al llegar")
    ).toBeChecked();
    expect(screen.getByLabelText("Habilitar pagar online")).not.toBeChecked();
  });

  it("saves immediately when a toggle changes, including turning both off", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        payAtPropertyEnabled: true,
        payOnlineEnabled: true,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PaymentMethodsSettings />);
    const payOnline = await screen.findByLabelText("Habilitar pagar online");

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        payAtPropertyEnabled: true,
        payOnlineEnabled: true,
      }),
    });
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        payAtPropertyEnabled: true,
        payOnlineEnabled: false,
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
          }),
          method: "PUT",
        })
      )
    );
    expect(await screen.findByText("Guardado")).toBeVisible();
  });
});
