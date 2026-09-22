import { render, screen, within } from "@testing-library/react";
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
    occupancyPrices: [],
    slug: "individual",
  },
  {
    availableUnits: 1,
    capacity: 2,
    name: "Habitación Doble",
    nightlyPriceClp: 70000,
    occupancyPrices: [
      { occupancy: 1, priceClp: 60000 },
      { occupancy: 2, priceClp: 70000 },
    ],
    slug: "doble",
  },
] as const;

const breakfast = {
  description: "Desayuno continental con café, jugo y pan.",
  unitPriceClp: 8000,
} as const;

function roomCard(roomName: string) {
  return screen
    .getAllByText(roomName)
    .find((el) => el.tagName === "H4")!
    .closest("div.vv-quotation-room-option")! as HTMLElement;
}

async function selectRoom(
  user: ReturnType<typeof userEvent.setup>,
  roomName: string
) {
  await user.click(
    within(roomCard(roomName)).getByRole("button", { name: "Seleccionar" })
  );
}

async function setRoomGuestCount(
  user: ReturnType<typeof userEvent.setup>,
  roomName: string,
  guestCount: number
) {
  await user.click(
    within(roomCard(roomName)).getByRole("button", {
      name: String(guestCount),
    })
  );
}

async function fillContactFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/Empresa/), "Empresa demo");
  await user.type(screen.getByLabelText(/Persona de contacto/), "Ana Pérez");
  await user.type(
    screen.getByLabelText(/Correo electrónico/),
    "ana@example.com"
  );
  await user.click(document.getElementById("quotation-parking-yes")!);
  await user.type(screen.getByLabelText(/Mensaje/), "Necesitamos alojamiento.");
}

describe("CompanyQuotationForm", () => {
  it("hides the company data fields and prompts for a room until one is selected", async () => {
    const user = userEvent.setup();
    render(
      <CompanyQuotationForm
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={2}
        rooms={rooms}
      />
    );

    expect(
      screen.getByText(
        "Selecciona una o más habitaciones para continuar con tu cotización."
      )
    ).toBeVisible();
    expect(screen.queryByLabelText(/Empresa/)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Generar y enviar cotización" })
    ).not.toBeInTheDocument();

    await selectRoom(user, "Habitación Doble");

    expect(
      screen.queryByText(
        "Selecciona una o más habitaciones para continuar con tu cotización."
      )
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Empresa/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Generar y enviar cotización" })
    ).toBeVisible();
  });

  it("disables the submit button while the assigned guests are incomplete and enables it once they match exactly", async () => {
    const user = userEvent.setup();
    render(
      <CompanyQuotationForm
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={2}
        rooms={rooms}
      />
    );

    await selectRoom(user, "Habitación Individual");
    expect(screen.getByText(/Huéspedes asignados: 1 de 2/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Generar y enviar cotización" })
    ).toBeDisabled();

    await selectRoom(user, "Habitación Doble");
    expect(screen.getByText(/Huéspedes asignados: 2 de 2/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Generar y enviar cotización" })
    ).toBeEnabled();
  });

  it("updates the displayed nightly price to match the selected occupancy tier", async () => {
    const user = userEvent.setup();
    render(
      <CompanyQuotationForm
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={2}
        rooms={rooms}
      />
    );

    await selectRoom(user, "Habitación Doble");
    expect(
      within(roomCard("Habitación Doble")).getByText("$60.000")
    ).toBeVisible();

    await setRoomGuestCount(user, "Habitación Doble", 2);
    expect(
      within(roomCard("Habitación Doble")).getByText("$70.000")
    ).toBeVisible();
  });

  it("blocks assigning more guests than a room's capacity and blocks selecting more rooms once the total is reached", async () => {
    const user = userEvent.setup();
    render(
      <CompanyQuotationForm
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={1}
        rooms={rooms}
      />
    );

    // Individual's own capacity (1) already caps its guest-count options,
    // so exercise the cross-room block on Doble instead.
    await selectRoom(user, "Habitación Doble");
    expect(
      within(roomCard("Habitación Doble")).getByRole("button", { name: "2" })
    ).toBeDisabled();
    expect(
      within(roomCard("Habitación Doble")).getByRole("button", { name: "1" })
    ).toBeEnabled();

    expect(screen.getByText(/Huéspedes asignados: 1 de 1/)).toBeVisible();
    expect(
      within(roomCard("Habitación Individual")).getByRole("button", {
        name: "Seleccionar",
      })
    ).toBeDisabled();
  });

  it("lets the remaining guest count be assigned to any other selected room", async () => {
    const user = userEvent.setup();
    render(
      <CompanyQuotationForm
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={3}
        rooms={rooms}
      />
    );

    await selectRoom(user, "Habitación Doble");
    await setRoomGuestCount(user, "Habitación Doble", 2);
    expect(screen.getByText(/Huéspedes asignados: 2 de 3/)).toBeVisible();

    await selectRoom(user, "Habitación Individual");
    expect(screen.getByText(/Huéspedes asignados: 3 de 3/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Generar y enviar cotización" })
    ).toBeEnabled();
  });

  it("submits with a per-room guestCount once the distribution is complete", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({
          capacity: 2,
          lines: [
            {
              capacity: 2,
              guestCount: 2,
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
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={2}
        rooms={rooms}
      />
    );

    await selectRoom(user, "Habitación Doble");
    await setRoomGuestCount(user, "Habitación Doble", 2);
    await fillContactFields(user);

    await user.click(
      screen.getByRole("button", { name: "Generar y enviar cotización" })
    );

    expect(fetch).toHaveBeenCalledTimes(1);
    const [, requestInit] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    const sentBody = JSON.parse(requestInit.body as string);
    expect(sentBody).toMatchObject({
      breakfastRequested: false,
      checkIn: "2026-10-05",
      checkOut: "2026-10-08",
      guestCount: 2,
      requireParking: true,
      rooms: [{ guestCount: 2, quantity: 1, slug: "doble" }],
    });
    const dialog = await screen.findByRole("dialog", {
      name: "Cotización enviada",
    });
    expect(dialog).toBeVisible();
  });

  it("requires an explicit parking answer before submitting", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();
    render(
      <CompanyQuotationForm
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={2}
        rooms={rooms}
      />
    );

    await selectRoom(user, "Habitación Doble");
    await setRoomGuestCount(user, "Habitación Doble", 2);
    await user.type(screen.getByLabelText(/Empresa/), "Empresa demo");
    await user.type(screen.getByLabelText(/Persona de contacto/), "Ana Pérez");
    await user.type(
      screen.getByLabelText(/Correo electrónico/),
      "ana@example.com"
    );
    await user.type(
      screen.getByLabelText(/Mensaje/),
      "Necesitamos alojamiento."
    );
    await user.click(
      screen.getByRole("button", { name: "Generar y enviar cotización" })
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(screen.getByText("Este campo es obligatorio.")).toBeVisible();
  });

  it("shows the breakfast detail block only after selecting Sí and validates the quantity", async () => {
    const user = userEvent.setup();
    render(
      <CompanyQuotationForm
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={2}
        rooms={rooms}
      />
    );
    await selectRoom(user, "Habitación Doble");
    await setRoomGuestCount(user, "Habitación Doble", 2);

    expect(screen.queryByText(breakfast.description)).not.toBeInTheDocument();

    await user.click(document.getElementById("quotation-breakfast-yes")!);
    expect(screen.getByText(breakfast.description)).toBeVisible();
    expect(screen.getByLabelText(/Desayunos por noche/)).toBeVisible();

    await user.click(document.getElementById("quotation-parking-yes")!);
    await user.type(screen.getByLabelText(/Empresa/), "Empresa demo");
    await user.type(screen.getByLabelText(/Persona de contacto/), "Ana Pérez");
    await user.type(
      screen.getByLabelText(/Correo electrónico/),
      "ana@example.com"
    );
    await user.type(
      screen.getByLabelText(/Mensaje/),
      "Necesitamos alojamiento."
    );
    await user.click(
      screen.getByRole("button", { name: "Generar y enviar cotización" })
    );

    expect(screen.getByText("Indique una cantidad válida.")).toBeVisible();
  });
});
