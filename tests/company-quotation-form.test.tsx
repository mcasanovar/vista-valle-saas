import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CompanyQuotationForm } from "@/presentation/organisms";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const rooms = [
  {
    availableUnits: 1,
    capacity: 1,
    name: "Habitación Individual",
    nightlyPriceClp: 55000,
    slug: "individual",
  },
  {
    availableUnits: 1,
    capacity: 2,
    name: "Habitación Doble",
    nightlyPriceClp: 70000,
    slug: "doble",
  },
] as const;

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Empresa/), "Empresa demo");
  await user.type(screen.getByLabelText(/Persona de contacto/), "Ana Pérez");
  await user.type(screen.getByLabelText(/Correo electrónico/), "ana@example.com");
  await user.type(screen.getByLabelText(/Requisitos/), "Desayuno incluido");
  await user.type(screen.getByLabelText(/Mensaje/), "Necesitamos alojamiento.");
  await user.click(
    screen.getAllByRole("button", { name: "Seleccionar" }).find(
      (button) =>
        button.closest("div")?.textContent?.includes("Habitación Doble")
    )!
  );
}

describe("CompanyQuotationForm", () => {
  it("toggles a room selection between Seleccionar/Seleccionado and recalculates capacity", async () => {
    const user = userEvent.setup();
    render(
      <CompanyQuotationForm
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={5}
        rooms={rooms}
      />
    );

    const toggle = screen
      .getAllByRole("button", { name: "Seleccionar" })
      .find((button) =>
        button.closest("div")?.textContent?.includes("Habitación Doble")
      )!;
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(/Capacidad seleccionada: 0 personas/)).toBeVisible();

    await user.click(toggle);
    expect(
      screen.getByRole("button", { name: "Seleccionado" })
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Capacidad seleccionada: 2 personas/)).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Seleccionado" }));
    expect(
      screen.queryByRole("button", { name: "Seleccionado" })
    ).not.toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Seleccionar" })).toHaveLength(2);
    expect(screen.getByText(/Capacidad seleccionada: 0 personas/)).toBeVisible();
  });

  it("allows submitting a partial quotation when selected capacity falls short of guests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          capacity: 2,
          lines: [
            {
              capacity: 2,
              name: "Habitación Doble",
              nightlyPriceClp: 70000,
              nights: 3,
              quantity: 1,
              slug: "doble",
              subtotalClp: 210000,
            },
          ],
          nights: 3,
          totalClp: 210000,
        }),
        ok: true,
      })
    );
    const user = userEvent.setup();
    render(
      <CompanyQuotationForm
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={5}
        rooms={rooms}
      />
    );

    await fillRequiredFields(user);
    expect(screen.getByText("Faltan 3 personas de capacidad. Puedes enviar igualmente una cotización parcial.")).toBeVisible();

    await user.click(
      screen.getByRole("button", { name: "Generar y enviar cotización" })
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, requestInit] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(requestInit.body as string);
    expect(sentBody).toMatchObject({
      checkIn: "2026-10-05",
      checkOut: "2026-10-08",
      guestCount: 5,
    });
    const dialog = await screen.findByRole("dialog", {
      name: "Cotización enviada",
    });
    expect(dialog).toBeVisible();
    expect(screen.queryByText(/\$210\.000/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Total/)).not.toBeInTheDocument();
    expect(screen.getByText("Faltan 3 personas de capacidad. Puedes enviar igualmente una cotización parcial.")).toBeVisible();
  });
});
