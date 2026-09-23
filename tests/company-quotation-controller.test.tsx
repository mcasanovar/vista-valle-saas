import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { CompanyQuotationController } from "@/presentation/organisms";

function mockFetchOnce(body: unknown, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({ json: async () => body, ok })
  );
}

async function fillSearch(
  user: ReturnType<typeof userEvent.setup>,
  { checkIn = "2026-10-05", checkOut = "2026-10-08", guests = "3" } = {}
) {
  if (checkIn) {
    await user.type(screen.getByLabelText(/Fecha de entrada/), checkIn);
  }
  if (checkOut) {
    await user.type(screen.getByLabelText(/Fecha de salida/), checkOut);
  }
  if (guests) {
    await user.type(screen.getByLabelText(/Personas a alojar/), guests);
  }
}

const oneIndividualRoomAvailable = {
  checkIn: "2026-10-05",
  checkOut: "2026-10-08",
  coversGuestCount: true,
  guestCount: 1,
  rooms: [
    {
      availableUnits: 1,
      capacity: 1,
      name: "Habitación Individual",
      nightlyPriceClp: 55000,
      occupancyPrices: [],
      slug: "individual",
    },
  ],
  roomTypes: [
    {
      availableUnits: 1,
      capacity: 1,
      name: "Habitación Individual",
      nightlyPriceClp: 55000,
      slug: "individual",
      totalUnits: 1,
    },
  ],
  totalActiveRooms: 1,
  totalAvailableCapacity: 1,
  totalAvailableRooms: 1,
};

describe("CompanyQuotationController", () => {
  it("shows a safe Spanish recovery message when availability fails unexpectedly", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("upstream timeout"))
    );
    const user = userEvent.setup();
    render(<CompanyQuotationController />);

    await fillSearch(user);
    await user.click(
      screen.getByRole("button", { name: "Consultar disponibilidad" })
    );

    expect(
      await screen.findByText("No pudimos consultar disponibilidad.")
    ).toBeVisible();
    expect(screen.queryByText("upstream timeout")).not.toBeInTheDocument();
  });

  it("blocks the availability query when dates or guests are missing, without calling fetch", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();
    render(<CompanyQuotationController />);

    await user.click(
      screen.getByRole("button", { name: "Consultar disponibilidad" })
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(
      screen.getAllByText("Este campo es obligatorio.").length
    ).toBeGreaterThan(0);
  });

  it("shows the number of nights as soon as both dates are entered, before querying availability", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();
    render(<CompanyQuotationController />);

    await user.type(screen.getByLabelText(/Fecha de entrada/), "2026-10-05");
    expect(screen.queryByText(/noche/)).not.toBeInTheDocument();

    await user.type(screen.getByLabelText(/Fecha de salida/), "2026-10-08");
    expect(screen.getByText("Estás seleccionando 3 noches.")).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("updates the night count when dates change, and hides it for an invalid range", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const user = userEvent.setup();
    render(<CompanyQuotationController />);

    await user.type(screen.getByLabelText(/Fecha de entrada/), "2026-10-05");
    await user.type(screen.getByLabelText(/Fecha de salida/), "2026-10-06");
    expect(screen.getByText("Estás seleccionando 1 noche.")).toBeVisible();

    await user.clear(screen.getByLabelText(/Fecha de salida/));
    await user.type(screen.getByLabelText(/Fecha de salida/), "2026-10-09");
    expect(screen.getByText("Estás seleccionando 4 noches.")).toBeVisible();

    await user.clear(screen.getByLabelText(/Fecha de salida/));
    await user.type(screen.getByLabelText(/Fecha de salida/), "2026-10-05");
    expect(screen.queryByText(/noche/)).not.toBeInTheDocument();
  });

  it("queries availability with the entered dates and guest count via keyboard", async () => {
    mockFetchOnce({
      checkIn: "2026-10-05",
      checkOut: "2026-10-08",
      coversGuestCount: true,
      guestCount: 3,
      rooms: [
        {
          availableUnits: 1,
          capacity: 2,
          name: "Habitación Doble",
          nightlyPriceClp: 70000,
          occupancyPrices: [],
          slug: "doble",
        },
      ],
      roomTypes: [
        {
          availableUnits: 1,
          capacity: 2,
          name: "Habitación Doble",
          nightlyPriceClp: 70000,
          slug: "doble",
          totalUnits: 1,
        },
      ],
      totalActiveRooms: 3,
      totalAvailableCapacity: 2,
      totalAvailableRooms: 1,
    });
    const user = userEvent.setup();
    render(<CompanyQuotationController />);

    await fillSearch(user);
    await user.keyboard("{Enter}");

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const [url] = (fetch as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string];
    expect(url).toContain("checkIn=2026-10-05");
    expect(url).toContain("checkOut=2026-10-08");
    expect(url).toContain("guestCount=3");
  });

  it("informs full availability and shows the quotation form when every room is free", async () => {
    mockFetchOnce({
      ...oneIndividualRoomAvailable,
      guestCount: 2,
      totalActiveRooms: 1,
    });
    const user = userEvent.setup();
    render(<CompanyQuotationController />);
    await fillSearch(user, { guests: "2" });
    await user.click(
      screen.getByRole("button", { name: "Consultar disponibilidad" })
    );

    expect(
      screen.getByRole("form", {
        name: "Formulario de cotización para empresas",
      })
    ).toBeInTheDocument();
  });

  it("hides the search panel once the rooms step is reached, and Atrás returns to it", async () => {
    mockFetchOnce(oneIndividualRoomAvailable);
    const user = userEvent.setup();
    render(<CompanyQuotationController />);
    await fillSearch(user, { guests: "1" });
    await user.click(
      screen.getByRole("button", { name: "Consultar disponibilidad" })
    );
    await screen.findByRole("form", {
      name: "Formulario de cotización para empresas",
    });

    expect(
      screen.queryByLabelText(/Fecha de entrada/)
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Editar fechas y personas" })
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atrás" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Atrás" }));
    expect(screen.getByLabelText(/Fecha de entrada/)).toHaveValue(
      "2026-10-05"
    );
    expect(
      screen.queryByRole("form", {
        name: "Formulario de cotización para empresas",
      })
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Atrás" })
    ).not.toBeInTheDocument();
  });

  it("returns from the company step to the rooms step via Atrás, without a room-specific edit button", async () => {
    mockFetchOnce(oneIndividualRoomAvailable);
    const user = userEvent.setup();
    render(<CompanyQuotationController />);
    await fillSearch(user, { guests: "1" });
    await user.click(
      screen.getByRole("button", { name: "Consultar disponibilidad" })
    );
    await screen.findByRole("form", {
      name: "Formulario de cotización para empresas",
    });

    await user.click(screen.getByRole("button", { name: "Elegir habitación" }));
    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(
      screen.getByRole("button", { name: "Agregar habitación" })
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(screen.getByLabelText(/Empresa/)).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Editar habitaciones" })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Atrás" }));
    expect(
      screen.getByRole("heading", { name: "Habitaciones disponibles" })
    ).toBeVisible();
  });

  it("informs partial insufficient availability, the shortfall, and hides the form", async () => {
    mockFetchOnce({
      checkIn: "2026-10-05",
      checkOut: "2026-10-08",
      coversGuestCount: false,
      guestCount: 5,
      rooms: [
        {
          availableUnits: 1,
          capacity: 1,
          name: "Habitación Individual",
          nightlyPriceClp: 55000,
          occupancyPrices: [],
          slug: "individual",
        },
      ],
      roomTypes: [
        {
          availableUnits: 1,
          capacity: 1,
          name: "Habitación Individual",
          nightlyPriceClp: 55000,
          slug: "individual",
          totalUnits: 1,
        },
      ],
      totalActiveRooms: 3,
      totalAvailableCapacity: 1,
      totalAvailableRooms: 1,
    });
    const user = userEvent.setup();
    render(<CompanyQuotationController />);
    await fillSearch(user, { guests: "5" });
    await user.click(
      screen.getByRole("button", { name: "Consultar disponibilidad" })
    );

    expect(await screen.findByText(/Faltan 4 personas/)).toBeVisible();
    expect(
      screen.queryByRole("form", {
        name: "Formulario de cotización para empresas",
      })
    ).not.toBeInTheDocument();
    // Insufficient availability keeps the search panel visible (step 1).
    expect(screen.getByLabelText(/Fecha de entrada/)).toBeVisible();
  });

  it("informs zero availability and hides the quotation form", async () => {
    mockFetchOnce({
      checkIn: "2026-10-05",
      checkOut: "2026-10-08",
      coversGuestCount: false,
      guestCount: 2,
      rooms: [],
      roomTypes: [
        {
          availableUnits: 0,
          capacity: 1,
          name: "Habitación Individual",
          nightlyPriceClp: 55000,
          slug: "individual",
          totalUnits: 1,
        },
      ],
      totalActiveRooms: 3,
      totalAvailableCapacity: 0,
      totalAvailableRooms: 0,
    });
    const user = userEvent.setup();
    render(<CompanyQuotationController />);
    await fillSearch(user);
    await user.click(
      screen.getByRole("button", { name: "Consultar disponibilidad" })
    );

    expect(
      await screen.findByText(/No hay habitaciones disponibles/)
    ).toBeVisible();
    expect(
      screen.queryByRole("form", {
        name: "Formulario de cotización para empresas",
      })
    ).not.toBeInTheDocument();
  });

  it("shows a persistent 3-step progress indicator that reflects the current step", async () => {
    mockFetchOnce(oneIndividualRoomAvailable);
    const user = userEvent.setup();
    render(<CompanyQuotationController />);

    const nav = screen.getByRole("navigation", {
      name: "Progreso de la cotización",
    });
    expect(nav.querySelector('[aria-current="step"]')).toHaveTextContent(
      "Fechas y personas"
    );

    await fillSearch(user, { guests: "1" });
    await user.click(
      screen.getByRole("button", { name: "Consultar disponibilidad" })
    );
    await screen.findByRole("form", {
      name: "Formulario de cotización para empresas",
    });
    expect(nav.querySelector('[aria-current="step"]')).toHaveTextContent(
      "Habitaciones"
    );

    await user.click(screen.getByRole("button", { name: "Elegir habitación" }));
    await user.click(screen.getByRole("button", { name: "1" }));
    await user.click(
      screen.getByRole("button", { name: "Agregar habitación" })
    );
    await user.click(screen.getByRole("button", { name: "Continuar" }));

    expect(nav.querySelector('[aria-current="step"]')).toHaveTextContent(
      "Datos de empresa y desayunos"
    );
  });

  it("replaces the previous result when the search is run again with different criteria", async () => {
    mockFetchOnce(oneIndividualRoomAvailable);
    const user = userEvent.setup();
    render(<CompanyQuotationController />);
    await fillSearch(user, { guests: "1" });
    await user.click(
      screen.getByRole("button", { name: "Consultar disponibilidad" })
    );
    await screen.findByRole("form", {
      name: "Formulario de cotización para empresas",
    });

    await user.click(screen.getByRole("button", { name: "Atrás" }));
    mockFetchOnce({
      checkIn: "2026-11-01",
      checkOut: "2026-11-03",
      coversGuestCount: false,
      guestCount: 2,
      rooms: [],
      roomTypes: [
        {
          availableUnits: 0,
          capacity: 1,
          name: "Habitación Individual",
          nightlyPriceClp: 55000,
          slug: "individual",
          totalUnits: 1,
        },
      ],
      totalActiveRooms: 1,
      totalAvailableCapacity: 0,
      totalAvailableRooms: 0,
    });
    await user.clear(screen.getByLabelText(/Fecha de entrada/));
    await user.type(screen.getByLabelText(/Fecha de entrada/), "2026-11-01");
    await user.clear(screen.getByLabelText(/Fecha de salida/));
    await user.type(screen.getByLabelText(/Fecha de salida/), "2026-11-03");
    await user.clear(screen.getByLabelText(/Personas a alojar/));
    await user.type(screen.getByLabelText(/Personas a alojar/), "2");
    await user.click(
      screen.getByRole("button", { name: "Consultar disponibilidad" })
    );

    expect(
      await screen.findByText(/No hay habitaciones disponibles/)
    ).toBeVisible();
    expect(
      screen.queryByRole("form", {
        name: "Formulario de cotización para empresas",
      })
    ).not.toBeInTheDocument();
  });
});
