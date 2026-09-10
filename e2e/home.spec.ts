import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { name: "mobile", width: 375, height: 800 },
  { name: "tablet", width: 768, height: 900 },
  { name: "notebook", width: 1024, height: 900 },
  { name: "desktop", width: 1440, height: 1000 },
] as const;

async function expectNoHorizontalOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
}

async function expectNoProviderRequests(page: Page) {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    const hostname = new URL(request.url()).hostname;

    if (hostname !== "127.0.0.1" && hostname !== "localhost") {
      providerRequests.push(request.url());
    }
  });

  return providerRequests;
}

test.describe("public responsive pages", () => {
  for (const viewport of viewports) {
    test(`home remains usable at ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      const providerRequests = await expectNoProviderRequests(page);
      await page.goto("/");

      await expect(
        page.getByRole("heading", {
          level: 1,
          name: "Descansa con una experiencia para recordar",
        })
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Reservar", exact: true })
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Ver habitación" }).first()
      ).toBeVisible();
      await expectNoHorizontalOverflow(page);

      await expect(
        page.getByRole("form", { name: "Consulta de disponibilidad" })
      ).toBeVisible();
      await expect(page.getByLabel("Fecha de entrada")).toBeVisible();
      await expect(page.getByLabel("Fecha de salida")).toBeVisible();
      await expect(
        page.getByRole("status", { name: /Huéspedes:/ })
      ).toBeVisible();
      await expect(
        page.getByRole("link", { name: "Solicitar cotización" })
      ).toHaveAttribute("href", "/cotizacion-empresa");
      await expect(
        page.getByRole("form", {
          name: "Formulario de cotización para empresas",
        })
      ).toHaveCount(0);
      expect(providerRequests).toEqual([]);
    });
  }

  test("keeps hero controls anchored when date errors are shown", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto("/");
    await page.addStyleTag({
      content:
        '[data-motion="enabled"] { opacity: 1 !important; transform: none !important; } nextjs-portal { display: none !important; }',
    });

    const search = page.getByRole("form", {
      name: "Consulta de disponibilidad",
    });
    const guestCounter = search.getByRole("status", { name: /Huéspedes:/ });
    const submit = search.getByRole("button", {
      name: "Consultar disponibilidad",
    });
    const checkIn = search.getByLabel("Fecha de entrada");
    const announcement = page.getByText(
      "Revisa los campos marcados antes de continuar."
    );

    const before = {
      guestCounter: await guestCounter.boundingBox(),
      submit: await submit.boundingBox(),
    };

    await submit.click();

    const checkInError = search.getByText("La fecha de entrada no es válida.");
    await expect(checkInError).toBeVisible();
    await expect(
      search.getByText("La fecha de salida no es válida.")
    ).toBeVisible();

    const inputBox = await checkIn.boundingBox();
    const errorBox = await checkInError.boundingBox();
    const after = {
      guestCounter: await guestCounter.boundingBox(),
      submit: await submit.boundingBox(),
    };

    expect(inputBox).not.toBeNull();
    expect(errorBox).not.toBeNull();
    expect(before.guestCounter).not.toBeNull();
    expect(before.submit).not.toBeNull();
    expect(after.guestCounter).not.toBeNull();
    expect(after.submit).not.toBeNull();
    const announcementBox = await announcement.boundingBox();
    const announcementContentTop = await announcement.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return element.getBoundingClientRect().top + parseFloat(style.paddingTop);
    });
    expect(announcementBox).not.toBeNull();
    expect(errorBox!.y).toBeGreaterThan(inputBox!.y + inputBox!.height);
    expect(announcementContentTop).toBeGreaterThan(
      errorBox!.y + errorBox!.height
    );
    expect(after.guestCounter!.y).toBe(before.guestCounter!.y);
    expect(after.submit!.y).toBe(before.submit!.y);
  });

  test("mobile navigation is keyboard-operable and returns focus", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto("/");

    const menuButton = page.getByRole("button", { name: "Abrir navegación" });
    await menuButton.focus();
    await expect(menuButton).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("navigation", { name: "Navegación móvil" })
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Habitaciones" }).last()
    ).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Abrir navegación" })
    ).toBeFocused();
  });

  test("catalogue and demo detail retain accessible navigation", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto("/habitaciones");

    await expect(
      page.getByRole("heading", { level: 1, name: "Habitaciones" })
    ).toBeVisible();
    await expect(page.getByRole("article")).toHaveCount(3);
    await expectNoHorizontalOverflow(page);

    const firstRoomLink = page
      .getByRole("link", { name: "Ver habitación" })
      .first();
    await expect(firstRoomLink).toHaveAttribute(
      "href",
      "/habitaciones/habitacion-valle-demo"
    );
    await firstRoomLink.click();

    await expect(page).toHaveURL(/\/habitaciones\/habitacion-valle-demo$/);
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Habitación Individual",
      })
    ).toBeVisible();
    await expect(
      page.getByText("Contenido de demostración").first()
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Consultar disponibilidad" })
    ).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test("public mock pages do not request external providers", async ({
  page,
}) => {
  const providerRequests = await expectNoProviderRequests(page);

  await page.goto("/");
  await page.goto("/habitaciones");
  await page.goto("/habitaciones/habitacion-valle-demo");

  expect(providerRequests).toEqual([]);
});

test("availability results remain usable from 320px through desktop", async ({
  page,
}) => {
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(
      "/disponibilidad?checkIn=2055-01-01&checkOut=2055-01-03&guests=2"
    );
    await expect(
      page.getByRole("heading", { level: 1, name: "Disponibilidad" })
    ).toBeVisible();
    await expect(
      page.getByRole("form", { name: "Consulta de disponibilidad" })
    ).toBeVisible();
    // guests=2 no longer excludes single-capacity rooms - all 3 demo rooms
    // remain candidates so the party can split across them.
    await expect(page.getByText("3 habitaciones disponibles")).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    const smallTargets = await page.locator("main button, main a").evaluateAll(
      (elements) =>
        elements.filter((element) => {
          const rect = element.getBoundingClientRect();
          return (
            rect.width > 0 &&
            rect.height > 0 &&
            (rect.width < 44 || rect.height < 44)
          );
        }).length
    );
    expect(smallTargets).toBe(0);
  }
});

test("allows the mock administrator and keeps login outside protected routes", async ({
  page,
}) => {
  const providerRequests = await expectNoProviderRequests(page);

  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Resumen operativo" })
  ).toBeVisible();

  await page.goto("/admin/login");
  await expect(
    page.getByRole("heading", { name: "Acceso administrativo" })
  ).toBeVisible();
  expect(providerRequests).toEqual([]);
});
