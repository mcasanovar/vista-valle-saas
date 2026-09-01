import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

async function mockAvailability(
  page: Page,
  body: Readonly<{
    checkIn: string;
    checkOut: string;
    coversGuestCount: boolean;
    guestCount: number;
    rooms: readonly Readonly<{
      availableUnits: number;
      capacity: number;
      name: string;
      nightlyPriceClp: number;
      slug: string;
    }>[];
    totalActiveRooms: number;
    totalAvailableCapacity: number;
    totalAvailableRooms: number;
  }>
) {
  await page.route("**/api/company-quotations/availability**", (route) =>
    route.fulfill({ json: body })
  );
}

// Next.js dev-mode hydration can still be in flight right after `goto`:
// filling a controlled input before hydration settles gets silently reset
// once React mounts with its initial (empty) state. `toPass` retries the
// fill until it actually sticks instead of racing a fixed wait.
async function fillReliably(page: Page, label: string, value: string) {
  await expect(async () => {
    const field = page.getByLabel(label);
    await field.fill(value);
    await expect(field).toHaveValue(value);
  }).toPass({ timeout: 15_000 });
}

function roomCard(page: Page, roomName: string) {
  return page.locator(".rounded-lg.border-border").filter({ hasText: roomName });
}

async function fillSearch(
  page: Page,
  { checkIn = "2026-10-05", checkOut = "2026-10-08", guests = "4" } = {}
) {
  await fillReliably(page, "Fecha de entrada", checkIn);
  await fillReliably(page, "Fecha de salida", checkOut);
  await fillReliably(page, "Personas a alojar", guests);
  await page
    .getByRole("button", { name: "Consultar disponibilidad" })
    .click();
}

test.describe("company quotation flow", () => {
  test("remains usable without horizontal overflow at supported widths", async ({
    page,
  }) => {
    for (const viewport of [
      { width: 320, height: 800 },
      { width: 375, height: 800 },
      { width: 768, height: 900 },
      { width: 1024, height: 900 },
      { width: 1440, height: 1000 },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/cotizacion-empresa");
      await expect(page.getByRole("main")).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= window.innerWidth
        )
      ).toBe(true);
    }
  });

  test("has no automated accessibility violations", async ({ page }) => {
    await page.goto("/cotizacion-empresa");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("moves from the landing CTA through full availability to a calculated quotation", async ({
    page,
  }) => {
    const externalRequests: string[] = [];
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (
        !url.hostname.includes("localhost") &&
        !url.hostname.includes("127.0.0.1")
      ) {
        externalRequests.push(request.url());
      }
    });

    await page.goto("/");
    await expect(
      page.getByRole("link", { name: "Solicitar cotización" })
    ).toHaveAttribute("href", "/cotizacion-empresa");
    await page.getByRole("link", { name: "Solicitar cotización" }).click();
    await expect(page).toHaveURL(/\/cotizacion-empresa$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Solicita una cotización para tu empresa",
      })
    ).toBeVisible();

    // The mock inventory has exactly one free room of each type, so
    // requesting capacity for all three (1 + 1 + 2 = 4) exercises the
    // "every active room is free" availability outcome against the real
    // endpoint, without mocking the network.
    await fillSearch(page, { guests: "4" });
    await expect(
      page.getByText(/Todas las habitaciones están disponibles/)
    ).toBeVisible();

    await roomCard(page, "Habitación Individual")
      .getByRole("button", { name: "Seleccionar" })
      .click();
    await roomCard(page, "Habitación Matrimonial")
      .getByRole("button", { name: "Seleccionar" })
      .click();
    await roomCard(page, "Habitación Doble")
      .getByRole("button", { name: "Seleccionar" })
      .click();
    await expect(
      page.getByText("Capacidad seleccionada: 4 personas")
    ).toBeVisible();

    await page
      .getByRole("textbox", { name: "Empresa (requerido)" })
      .fill("Empresa demo");
    await page
      .getByRole("textbox", { name: "Persona de contacto (requerido)" })
      .fill("Ana Pérez");
    await page
      .getByRole("textbox", { name: "Correo electrónico (requerido)" })
      .fill("ana@example.com");
    await page
      .getByRole("textbox", { name: "Requisitos (requerido)" })
      .fill("Desayuno y estacionamiento");
    await page
      .getByRole("textbox", { name: "Mensaje (requerido)" })
      .fill("Solicitud de prueba");
    await page
      .getByRole("button", { name: "Generar y enviar cotización" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Cotización enviada" })
    ).toBeVisible();
    await expect(page.getByText(/\$555\.000/)).toHaveCount(0);
    expect(externalRequests).toEqual([]);
  });

  test("shows partial availability, the capacity shortfall, and still allows a partial quotation", async ({
    page,
  }) => {
    await mockAvailability(page, {
      checkIn: "2026-10-05",
      checkOut: "2026-10-08",
      coversGuestCount: false,
      guestCount: 3,
      rooms: [
        {
          availableUnits: 1,
          capacity: 1,
          name: "Habitación Individual",
          nightlyPriceClp: 55000,
          slug: "habitacion-valle-demo",
        },
      ],
      totalActiveRooms: 3,
      totalAvailableCapacity: 1,
      totalAvailableRooms: 1,
    });
    await page.goto("/cotizacion-empresa");
    await fillSearch(page, { guests: "3" });

    await expect(page.getByText(/Hay 1 habitación disponible/)).toBeVisible();
    await expect(page.getByText(/Faltan 2 personas/)).toBeVisible();

    const select = roomCard(page, "Habitación Individual").getByRole(
      "button",
      { name: "Seleccionar" }
    );
    await select.click();
    await expect(
      roomCard(page, "Habitación Individual").getByRole("button", {
        name: "Seleccionado",
      })
    ).toBeVisible();
    await expect(
      page.getByText(
        "Faltan 2 personas de capacidad. Puedes enviar igualmente una cotización parcial."
      )
    ).toBeVisible();

    await page
      .getByRole("textbox", { name: "Empresa (requerido)" })
      .fill("Empresa demo");
    await page
      .getByRole("textbox", { name: "Persona de contacto (requerido)" })
      .fill("Ana Pérez");
    await page
      .getByRole("textbox", { name: "Correo electrónico (requerido)" })
      .fill("ana@example.com");
    await page
      .getByRole("textbox", { name: "Requisitos (requerido)" })
      .fill("Desayuno y estacionamiento");
    await page
      .getByRole("textbox", { name: "Mensaje (requerido)" })
      .fill("Solicitud de prueba");
    await page
      .getByRole("button", { name: "Generar y enviar cotización" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Cotización enviada" })
    ).toBeVisible();
  });

  test("shows a confirmation modal on submit that closes and returns to the landing page", async ({
    page,
  }) => {
    await mockAvailability(page, {
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
          slug: "habitacion-valle-demo",
        },
      ],
      totalActiveRooms: 3,
      totalAvailableCapacity: 1,
      totalAvailableRooms: 1,
    });
    await page.goto("/cotizacion-empresa");
    await fillSearch(page, { guests: "1" });
    await roomCard(page, "Habitación Individual")
      .getByRole("button", { name: "Seleccionar" })
      .click();
    await page
      .getByRole("textbox", { name: "Empresa (requerido)" })
      .fill("Empresa demo");
    await page
      .getByRole("textbox", { name: "Persona de contacto (requerido)" })
      .fill("Ana Pérez");
    await page
      .getByRole("textbox", { name: "Correo electrónico (requerido)" })
      .fill("ana@example.com");
    await page
      .getByRole("textbox", { name: "Requisitos (requerido)" })
      .fill("Desayuno y estacionamiento");
    await page
      .getByRole("textbox", { name: "Mensaje (requerido)" })
      .fill("Solicitud de prueba");
    await page
      .getByRole("button", { name: "Generar y enviar cotización" })
      .click();

    const dialog = page.getByRole("dialog", { name: "Cotización enviada" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/\$/)).toHaveCount(0);

    await dialog.getByRole("button", { name: "Cerrar" }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
  });

  test("shows zero availability and hides the quotation form", async ({
    page,
  }) => {
    await mockAvailability(page, {
      checkIn: "2026-10-05",
      checkOut: "2026-10-08",
      coversGuestCount: false,
      guestCount: 2,
      rooms: [],
      totalActiveRooms: 3,
      totalAvailableCapacity: 0,
      totalAvailableRooms: 0,
    });
    await page.goto("/cotizacion-empresa");
    await fillSearch(page, { guests: "2" });

    await expect(
      page.getByText("No hay habitaciones disponibles para esas fechas.", {
        exact: false,
      })
    ).toBeVisible();
    await expect(
      page.getByRole("form", {
        name: "Formulario de cotización para empresas",
      })
    ).toHaveCount(0);
  });
});
