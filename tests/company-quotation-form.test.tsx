import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CompanyQuotationForm } from "@/presentation/organisms";
import type { CompanyQuotationFormStep } from "@/presentation/organisms/company-quotation-form";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

/**
 * In production, `step` is controlled by `CompanyQuotationController`
 * (it also owns "back" navigation between steps). This harness plays that
 * controller role for isolated form tests: it starts on "rooms" and
 * advances to "company" when the form asks to.
 */
function FormHarness(
  props: Omit<Parameters<typeof CompanyQuotationForm>[0], "onAdvanceStep" | "step">
) {
  const [step, setStep] = useState<CompanyQuotationFormStep>("rooms");
  return (
    <CompanyQuotationForm
      {...props}
      onAdvanceStep={() => setStep("company")}
      step={step}
    />
  );
}

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

async function chooseRoom(
  user: ReturnType<typeof userEvent.setup>,
  roomName: string
) {
  await user.click(
    within(roomCard(roomName)).getByRole("button", { name: "Elegir habitación" })
  );
}

async function setPendingGuestCount(
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

async function addRoom(
  user: ReturnType<typeof userEvent.setup>,
  roomName: string,
  guestCount: number
) {
  await chooseRoom(user, roomName);
  await setPendingGuestCount(user, roomName, guestCount);
  await user.click(
    within(roomCard(roomName)).getByRole("button", {
      name: "Agregar habitación",
    })
  );
}

async function continueToCompanyStep(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Continuar" }));
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
  it("only shows the rooms step until Continuar is pressed with a complete allocation", async () => {
    const user = userEvent.setup();
    render(
      <FormHarness
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={2}
        rooms={rooms}
      />
    );

    expect(
      screen.getByRole("heading", { name: "Habitaciones disponibles" })
    ).toBeVisible();
    expect(screen.queryByLabelText(/Empresa/)).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continuar" })
    ).toBeDisabled();

    await addRoom(user, "Habitación Doble", 2);
    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();

    await continueToCompanyStep(user);

    expect(
      screen.queryByRole("heading", { name: "Habitaciones disponibles" })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Empresa/)).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Generar y enviar cotización" })
    ).toBeVisible();
  });

  it("does not assign a room to the total until Agregar habitación is confirmed", async () => {
    const user = userEvent.setup();
    render(
      <FormHarness
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={2}
        rooms={rooms}
      />
    );

    await chooseRoom(user, "Habitación Doble");
    await setPendingGuestCount(user, "Habitación Doble", 2);
    let meter = screen.getByRole("status", { name: /Huéspedes asignados/ });
    expect(meter).toHaveAccessibleName(/Huéspedes asignados: 0 de 2/);

    await user.click(
      within(roomCard("Habitación Doble")).getByRole("button", {
        name: "Agregar habitación",
      })
    );
    meter = screen.getByRole("status", { name: /Huéspedes asignados/ });
    expect(meter).toHaveAccessibleName(/Huéspedes asignados: 2 de 2/);
    expect(
      within(roomCard("Habitación Doble")).getByText("2 personas asignadas")
    ).toBeVisible();
  });

  it("discards the pending configuration when Cancelar is pressed", async () => {
    const user = userEvent.setup();
    render(
      <FormHarness
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={2}
        rooms={rooms}
      />
    );

    await chooseRoom(user, "Habitación Doble");
    await user.click(
      within(roomCard("Habitación Doble")).getByRole("button", {
        name: "Cancelar",
      })
    );

    expect(
      within(roomCard("Habitación Doble")).getByRole("button", {
        name: "Elegir habitación",
      })
    ).toBeVisible();
    const meter = screen.getByRole("status", { name: /Huéspedes asignados/ });
    expect(meter).toHaveAccessibleName(/Huéspedes asignados: 0 de 2/);
  });

  it("removes an added room back to available with Quitar", async () => {
    const user = userEvent.setup();
    render(
      <FormHarness
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={2}
        rooms={rooms}
      />
    );

    await addRoom(user, "Habitación Doble", 2);
    await user.click(
      within(roomCard("Habitación Doble")).getByRole("button", {
        name: "Quitar",
      })
    );

    expect(
      within(roomCard("Habitación Doble")).getByRole("button", {
        name: "Elegir habitación",
      })
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Continuar" })).toBeDisabled();
  });

  it("prevents configuring another room while one is still pending", async () => {
    const user = userEvent.setup();
    render(
      <FormHarness
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={2}
        rooms={rooms}
      />
    );

    await chooseRoom(user, "Habitación Doble");
    expect(
      within(roomCard("Habitación Individual")).getByRole("button", {
        name: "Elegir habitación",
      })
    ).toBeDisabled();
  });

  it("updates the displayed nightly price while a room is pending and once added", async () => {
    const user = userEvent.setup();
    render(
      <FormHarness
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={2}
        rooms={rooms}
      />
    );

    await chooseRoom(user, "Habitación Doble");
    // Defaults to the largest useful occupancy (the full remaining total).
    expect(
      within(roomCard("Habitación Doble")).getByText("$70.000")
    ).toBeVisible();

    await setPendingGuestCount(user, "Habitación Doble", 1);
    expect(
      within(roomCard("Habitación Doble")).getByText("$60.000")
    ).toBeVisible();
  });

  it("blocks assigning more guests than a room's capacity and blocks choosing more rooms once the total is reached", async () => {
    const user = userEvent.setup();
    render(
      <FormHarness
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={1}
        rooms={rooms}
      />
    );

    // Individual's own capacity (1) already caps its guest-count options,
    // so exercise the cross-room block on Doble instead.
    await chooseRoom(user, "Habitación Doble");
    expect(
      within(roomCard("Habitación Doble")).getByRole("button", { name: "2" })
    ).toBeDisabled();
    expect(
      within(roomCard("Habitación Doble")).getByRole("button", { name: "1" })
    ).toBeEnabled();

    await user.click(
      within(roomCard("Habitación Doble")).getByRole("button", {
        name: "Agregar habitación",
      })
    );

    expect(
      within(roomCard("Habitación Individual")).getByRole("button", {
        name: "Elegir habitación",
      })
    ).toBeDisabled();
  });

  it("lets the remaining guest count be assigned to any other room", async () => {
    const user = userEvent.setup();
    render(
      <FormHarness
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={3}
        rooms={rooms}
      />
    );

    await addRoom(user, "Habitación Doble", 2);
    await addRoom(user, "Habitación Individual", 1);

    expect(screen.getByRole("button", { name: "Continuar" })).toBeEnabled();
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
      <FormHarness
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={2}
        rooms={rooms}
      />
    );

    await addRoom(user, "Habitación Doble", 2);
    await continueToCompanyStep(user);
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
      <FormHarness
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={2}
        rooms={rooms}
      />
    );

    await addRoom(user, "Habitación Doble", 2);
    await continueToCompanyStep(user);
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

  it("shows the breakfast detail block only after selecting Sí, with the per-night calculation hint, and validates the quantity", async () => {
    const user = userEvent.setup();
    render(
      <FormHarness
        breakfast={breakfast}
        checkIn="2026-10-05"
        checkOut="2026-10-08"
        guestCount={2}
        rooms={rooms}
      />
    );
    await addRoom(user, "Habitación Doble", 2);
    await continueToCompanyStep(user);

    expect(screen.queryByText(breakfast.description)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/se multiplica por la cantidad de noches/)
    ).not.toBeInTheDocument();

    await user.click(document.getElementById("quotation-breakfast-yes")!);
    expect(screen.getByText(breakfast.description)).toBeVisible();
    expect(screen.getByLabelText(/Desayunos por noche/)).toBeVisible();
    expect(
      screen.getByText(
        "Esta cantidad se multiplica por la cantidad de noches de tu estadía para calcular el total de desayunos."
      )
    ).toBeVisible();

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
