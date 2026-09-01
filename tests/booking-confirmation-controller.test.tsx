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
    render(<BookingConfirmationController bookingEnabled roomCount={1} />);

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

  it("offers the Fintoc online-payment option only for a single room", () => {
    const { rerender } = render(
      <BookingConfirmationController bookingEnabled roomCount={1} />
    );
    expect(
      screen.getByRole("radio", { name: /Pagar online/ })
    ).toBeInTheDocument();

    rerender(<BookingConfirmationController bookingEnabled roomCount={2} />);
    expect(
      screen.queryByRole("radio", { name: /Pagar online/ })
    ).not.toBeInTheDocument();
  });

  it("redirects to the Fintoc checkout URL when pago online is selected and confirmed", async () => {
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

    render(<BookingConfirmationController bookingEnabled roomCount={1} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("radio", { name: /Pagar online/ }));
    await user.click(screen.getByRole("button", { name: "Confirmar reserva" }));

    expect(window.location.href).toBe(
      "https://pay.fintoc.com/checkout/cs_123"
    );
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });
});
