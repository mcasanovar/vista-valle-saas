import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

type AvailableRoom = Readonly<{
  availableUnits: number;
  capacity: number;
  name: string;
  nightlyPriceClp: number;
  slug: string;
}>;

const DEMO_ROOM_TYPES: readonly Omit<AvailableRoom, "availableUnits">[] = [
  {
    capacity: 1,
    name: "Habitación Individual",
    nightlyPriceClp: 55000,
    slug: "habitacion-valle-demo",
  },
  {
    capacity: 1,
    name: "Habitación Matrimonial",
    nightlyPriceClp: 60000,
    slug: "habitacion-andes-demo",
  },
  {
    capacity: 2,
    name: "Habitación Doble",
    nightlyPriceClp: 70000,
    slug: "habitacion-terra-demo",
  },
];

/**
 * Builds the full per-type breakdown (available and unavailable) the real
 * availability route always returns, from just the free `rooms`, so each
 * test only has to say what's free.
 */
function roomTypesFrom(rooms: readonly AvailableRoom[]) {
  const availableBySlug = new Map(rooms.map((room) => [room.slug, room]));
  return DEMO_ROOM_TYPES.map((type) => {
    const available = availableBySlug.get(type.slug);
    return {
      ...type,
      availableUnits: available?.availableUnits ?? 0,
      totalUnits: 1,
    };
  });
}

const DEMO_BREAKFAST = Object.freeze({
  description: "Desayuno continental con café, jugo y pan.",
  unitPriceClp: 8000,
});

async function mockAvailability(
  page: Page,
  body: Readonly<{
    breakfast?: typeof DEMO_BREAKFAST | null;
    checkIn: string;
    checkOut: string;
    coversGuestCount: boolean;
    guestCount: number;
    rooms: readonly AvailableRoom[];
    totalActiveRooms: number;
    totalAvailableCapacity: number;
    totalAvailableRooms: number;
  }>
) {
  await page.route("**/api/company-quotations/availability**", (route) =>
    route.fulfill({
      json: {
        breakfast: DEMO_BREAKFAST,
        ...body,
        roomTypes: roomTypesFrom(body.rooms),
      },
    })
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
  return page
    .locator(".rounded-lg.border-border")
    .filter({ hasText: roomName });
}

async function answerParking(page: Page, requireParking: boolean) {
  await page
    .locator("#quotation-parking")
    .getByRole("button", { name: requireParking ? "Sí" : "No" })
    .click();
}

async function fillSearch(
  page: Page,
  { checkIn = "2026-10-05", checkOut = "2026-10-08", guests = "4" } = {}
) {
  await fillReliably(page, "Fecha de entrada", checkIn);
  await fillReliably(page, "Fecha de salida", checkOut);
  await fillReliably(page, "Personas a alojar", guests);
  await page.getByRole("button", { name: "Consultar disponibilidad" }).click();
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

  test("navigates from the landing CTA without rendering the quotation form there", async ({
    page,
  }) => {
    await page.goto("/");
    const cta = page.getByRole("link", { name: "Solicitar cotización" });

    await expect(cta).toHaveAttribute("href", "/cotizacion-empresa");
    await expect(
      page.getByRole("form", {
        name: "Formulario de cotización para empresas",
      })
    ).toHaveCount(0);

    await cta.click();
    await expect(page).toHaveURL("/cotizacion-empresa");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Solicita una cotización para tu empresa",
      })
    ).toBeVisible();
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

    await mockAvailability(page, {
      checkIn: "2026-10-05",
      checkOut: "2026-10-08",
      coversGuestCount: true,
      guestCount: 4,
      rooms: [
        {
          availableUnits: 1,
          capacity: 1,
          name: "Habitación Individual",
          nightlyPriceClp: 55000,
          slug: "habitacion-valle-demo",
        },
        {
          availableUnits: 1,
          capacity: 1,
          name: "Habitación Matrimonial",
          nightlyPriceClp: 60000,
          slug: "habitacion-andes-demo",
        },
        {
          availableUnits: 1,
          capacity: 2,
          name: "Habitación Doble",
          nightlyPriceClp: 70000,
          slug: "habitacion-terra-demo",
        },
      ],
      totalActiveRooms: 3,
      totalAvailableCapacity: 4,
      totalAvailableRooms: 3,
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

    // A local route fixture makes this outcome deterministic and ensures the
    // quotation journey remains fully offline in the mock configuration.
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
    await answerParking(page, true);
    await page
      .getByRole("textbox", { name: "Mensaje (requerido)" })
      .fill("Solicitud de prueba");
    await page
      .getByRole("button", { name: "Generar y enviar cotización" })
      .click();
    await expect(
      page.getByRole("dialog", { name: "Cotización enviada" })
    ).toBeVisible({ timeout: 30_000 });
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

    const select = roomCard(page, "Habitación Individual").getByRole("button", {
      name: "Seleccionar",
    });
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
    await answerParking(page, true);
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
    await answerParking(page, true);
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

  test("shows the breakfast detail only after selecting Sí and submits with a quantity", async ({
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

    await expect(page.getByText(DEMO_BREAKFAST.description)).toHaveCount(0);

    await page
      .locator("#quotation-breakfast")
      .getByRole("button", { name: "Sí" })
      .click();
    await expect(page.getByText(DEMO_BREAKFAST.description)).toBeVisible();

    await page
      .getByRole("textbox", { name: "Empresa (requerido)" })
      .fill("Empresa demo");
    await page
      .getByRole("textbox", { name: "Persona de contacto (requerido)" })
      .fill("Ana Pérez");
    await page
      .getByRole("textbox", { name: "Correo electrónico (requerido)" })
      .fill("ana@example.com");
    await answerParking(page, false);
    await page
      .getByRole("spinbutton", { name: "Cantidad de desayunos (requerido)" })
      .fill("2");
    await page
      .getByRole("textbox", { name: "Mensaje (requerido)" })
      .fill("Solicitud de prueba");
    await page
      .getByRole("button", { name: "Generar y enviar cotización" })
      .click();

    await expect(
      page.getByRole("dialog", { name: "Cotización enviada" })
    ).toBeVisible({ timeout: 30_000 });
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
