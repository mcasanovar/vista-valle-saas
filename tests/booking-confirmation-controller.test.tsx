import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BookingConfirmationController } from "@/features/reservations";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

describe("BookingConfirmationController", () => {
  it("disables the committing action while the confirmation is pending", async () => {
    let complete: (value: unknown) => void = () => undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockReturnValue(
        new Promise((resolve) => {
          complete = resolve;
        })
      )
    );
    render(<BookingConfirmationController bookingEnabled />);
    const button = screen.getByRole("button", { name: "Confirmar reserva" });
    await userEvent.setup().click(button);
    expect(button).toBeDisabled();
    await userEvent.setup().click(button);
    expect(fetch).toHaveBeenCalledTimes(1);
    complete({ ok: false, json: async () => ({ message: "No disponible" }) });
    expect(await screen.findByText("No disponible")).toBeVisible();
  });

  it("uses a safe Spanish fallback when the public request fails unexpectedly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("socket reset"))
    );
    render(<BookingConfirmationController bookingEnabled />);

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Confirmar reserva" }));

    expect(
      await screen.findByText(
        "No pudimos confirmar la reserva. Inténtalo nuevamente."
      )
    ).toBeVisible();
    expect(screen.queryByText("socket reset")).not.toBeInTheDocument();
  });

  it("shows a pause notice instead of the confirm button when bookings are disabled", () => {
    render(<BookingConfirmationController bookingEnabled={false} />);

    expect(
      screen.queryByRole("button", { name: "Confirmar reserva" })
    ).not.toBeInTheDocument();
    expect(screen.getByText("Reservas directas pausadas")).toBeVisible();
  });

  it("defaults to pago al llegar and confirms with that mode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ publicId: "VV-123" }),
      })
    );
    render(<BookingConfirmationController bookingEnabled />);

    expect(
      screen.getByRole("radio", { name: /Pagar al llegar/ })
    ).toBeChecked();

    await userEvent
      .setup()
      .click(screen.getByRole("button", { name: "Confirmar reserva" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/bookings/pay-at-property",
      expect.anything()
    );
  });

  it("offers all three payment options regardless of how many rooms are selected", () => {
    render(<BookingConfirmationController bookingEnabled />);
    expect(
      screen.getByRole("radio", { name: /Pagar al llegar/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Tarjeta de crédito o débito/ })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Transferencia bancaria/ })
    ).toBeInTheDocument();
  });

  it("hides pagar al llegar when the admin disabled it", () => {
    render(
      <BookingConfirmationController
        bookingEnabled
        payAtPropertyEnabled={false}
      />
    );
    expect(
      screen.queryByRole("radio", { name: /Pagar al llegar/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Transferencia bancaria/ })
    ).toBeChecked();
  });

  it("hides transferencia bancaria when the admin disabled Fintoc", () => {
    render(
      <BookingConfirmationController bookingEnabled payOnlineEnabled={false} />
    );
    expect(
      screen.queryByRole("radio", { name: /Transferencia bancaria/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Pagar al llegar/ })
    ).toBeChecked();
  });

  it("hides tarjeta when the admin disabled Mercado Pago", () => {
    render(
      <BookingConfirmationController bookingEnabled payByCardEnabled={false} />
    );
    expect(
      screen.queryByRole("radio", { name: /Tarjeta de crédito o débito/ })
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("radio", { name: /Pagar al llegar/ })
    ).toBeChecked();
  });

  it("shows no payment option and no confirm button when every method is disabled", () => {
    render(
      <BookingConfirmationController
        bookingEnabled
        payAtPropertyEnabled={false}
        payOnlineEnabled={false}
        payByCardEnabled={false}
      />
    );
    expect(screen.queryByRole("radiogroup")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Confirmar reserva" })
    ).not.toBeInTheDocument();
  });

  it("redirects to the Fintoc checkout URL when transferencia bancaria is selected and confirmed", async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          redirectUrl: "https://pay.fintoc.com/checkout/cs_123",
        }),
      })
    );

    render(<BookingConfirmationController bookingEnabled />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /Transferencia bancaria/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar reserva" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/bookings/fintoc-checkout",
      expect.anything()
    );
    expect(window.location.href).toBe(
      "https://pay.fintoc.com/checkout/cs_123"
    );
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("redirects to the Mercado Pago checkout URL when tarjeta is selected and confirmed", async () => {
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: { ...originalLocation, href: "" },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          redirectUrl: "https://www.mercadopago.cl/checkout/v1/redirect?pref_id=mp_1",
        }),
      })
    );

    render(<BookingConfirmationController bookingEnabled />);
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("radio", { name: /Tarjeta de crédito o débito/ })
    );
    await user.click(screen.getByRole("button", { name: "Confirmar reserva" }));

    expect(fetch).toHaveBeenCalledWith(
      "/api/bookings/mercadopago-checkout",
      expect.anything()
    );
    expect(window.location.href).toBe(
      "https://www.mercadopago.cl/checkout/v1/redirect?pref_id=mp_1"
    );
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
});
