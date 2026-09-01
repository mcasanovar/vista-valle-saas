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
          slug: "doble",
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
      checkIn: "2026-10-05",
      checkOut: "2026-10-08",
      coversGuestCount: true,
      guestCount: 2,
      rooms: [
        {
          availableUnits: 1,
          capacity: 1,
          name: "Habitación Individual",
          nightlyPriceClp: 55000,
          slug: "individual",
        },
      ],
      totalActiveRooms: 1,
      totalAvailableCapacity: 1,
      totalAvailableRooms: 1,
    });
    const user = userEvent.setup();
    render(<CompanyQuotationController />);
    await fillSearch(user);
    await user.click(
      screen.getByRole("button", { name: "Consultar disponibilidad" })
    );

    expect(
      await screen.findByText(/Todas las habitaciones están disponibles/)
    ).toBeVisible();
    expect(
      screen.getByRole("form", {
        name: "Formulario de cotización para empresas",
      })
    ).toBeInTheDocument();
  });

  it("informs partial but sufficient availability and still shows the form", async () => {
    mockFetchOnce({
      checkIn: "2026-10-05",
      checkOut: "2026-10-08",
      coversGuestCount: true,
      guestCount: 2,
      rooms: [
        {
          availableUnits: 1,
          capacity: 2,
          name: "Habitación Doble",
          nightlyPriceClp: 70000,
          slug: "doble",
        },
      ],
      totalActiveRooms: 3,
      totalAvailableCapacity: 2,
      totalAvailableRooms: 1,
    });
    const user = userEvent.setup();
    render(<CompanyQuotationController />);
    await fillSearch(user);
    await user.click(
      screen.getByRole("button", { name: "Consultar disponibilidad" })
    );

    expect(
      await screen.findByText(/Hay 1 habitación disponible/)
    ).toBeVisible();
    expect(
      screen.queryByText(/Todas las habitaciones están disponibles/)
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("form", {
        name: "Formulario de cotización para empresas",
      })
    ).toBeInTheDocument();
  });

  it("informs partial insufficient availability, the shortfall, and still shows the form", async () => {
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
          slug: "individual",
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
      screen.getByRole("form", {
        name: "Formulario de cotización para empresas",
      })
    ).toBeInTheDocument();
  });

  it("informs zero availability and hides the quotation form", async () => {
    mockFetchOnce({
      checkIn: "2026-10-05",
      checkOut: "2026-10-08",
      coversGuestCount: false,
      guestCount: 2,
      rooms: [],
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

  it("replaces the previous result when the search is run again with different criteria", async () => {
    mockFetchOnce({
      checkIn: "2026-10-05",
      checkOut: "2026-10-08",
      coversGuestCount: true,
      guestCount: 2,
      rooms: [
        {
          availableUnits: 1,
          capacity: 1,
          name: "Habitación Individual",
          nightlyPriceClp: 55000,
          slug: "individual",
        },
      ],
      totalActiveRooms: 1,
      totalAvailableCapacity: 1,
      totalAvailableRooms: 1,
    });
    const user = userEvent.setup();
    render(<CompanyQuotationController />);
    await fillSearch(user);
    await user.click(
      screen.getByRole("button", { name: "Consultar disponibilidad" })
    );
    expect(
      await screen.findByText(/Todas las habitaciones están disponibles/)
    ).toBeVisible();

    mockFetchOnce({
      checkIn: "2026-11-01",
      checkOut: "2026-11-03",
      coversGuestCount: false,
      guestCount: 2,
      rooms: [],
      totalActiveRooms: 1,
      totalAvailableCapacity: 0,
      totalAvailableRooms: 0,
    });
    await user.clear(screen.getByLabelText(/Fecha de entrada/));
    await user.type(screen.getByLabelText(/Fecha de entrada/), "2026-11-01");
    await user.clear(screen.getByLabelText(/Fecha de salida/));
    await user.type(screen.getByLabelText(/Fecha de salida/), "2026-11-03");
    await user.click(
      screen.getByRole("button", { name: "Consultar disponibilidad" })
    );

    expect(
      await screen.findByText(/No hay habitaciones disponibles/)
    ).toBeVisible();
    expect(
      screen.queryByText(/Todas las habitaciones están disponibles/)
    ).not.toBeInTheDocument();
  });
});
