import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { GuestInformationForm } from "@/features/reservations";

describe("GuestInformationForm", () => {
  it("has no Continuar button - fields validate on their own as the guest fills them in", () => {
    render(<GuestInformationForm />);
    expect(
      screen.queryByRole("button", { name: "Continuar" })
    ).not.toBeInTheDocument();
  });

  it("shows required invoice fields only when requested", async () => {
    render(<GuestInformationForm />);
    expect(screen.queryByLabelText(/Giro/)).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByLabelText("Solicitar factura"));
    expect(screen.getByLabelText(/Nombre o razón social/)).toBeRequired();
    expect(screen.getByLabelText(/^RUT/)).toBeRequired();
    expect(screen.getByLabelText(/Giro/)).toBeRequired();
  });

  it("validates each field automatically on blur, without requiring a submit step", async () => {
    const user = userEvent.setup();
    render(<GuestInformationForm />);

    const email = screen.getByLabelText("Correo electrónico (requerido)");
    await user.type(email, "correo-invalido");
    await user.tab();
    expect(
      (await screen.findAllByText("Ingresa un correo electrónico válido."))
        .length
    ).toBeGreaterThan(0);

    await user.clear(email);
    await user.type(email, "ana@example.com");
    await user.tab();
    expect(
      screen.queryByText("Ingresa un correo electrónico válido.")
    ).not.toBeInTheDocument();

    const firstName = screen.getByLabelText("Nombre (requerido)");
    await user.click(firstName);
    await user.tab();
    expect(
      (await screen.findAllByText("Este campo es obligatorio.")).length
    ).toBeGreaterThan(0);
  });

  it("shows the Chilean RUT validation message on blur once invoice data is requested", async () => {
    const user = userEvent.setup();
    render(<GuestInformationForm />);

    await user.click(screen.getByLabelText("Solicitar factura"));
    const rut = screen.getByLabelText(/^RUT/);
    await user.type(rut, "76.000.543-2");
    await user.tab();
    expect(
      (await screen.findAllByText("Ingresa un RUT chileno válido.")).length
    ).toBeGreaterThan(0);
  });

  it("syncs guest field values into the URL as soon as each field is left, without a Continuar click", async () => {
    const user = userEvent.setup();
    render(<GuestInformationForm />);

    await user.type(screen.getByLabelText("Nombre (requerido)"), "Ana");
    await user.tab();

    expect(window.location.search).toContain("firstName=Ana");
  });
});
