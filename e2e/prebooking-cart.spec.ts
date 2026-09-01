import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

const resultQuery = "checkIn=2061-02-10&checkOut=2061-02-13&guests=1";

async function fillGuest(page: Page, email: string) {
  await page.getByLabel("Nombre (requerido)").fill("Ana");
  await page.getByLabel("Apellido (requerido)").fill("Pérez");
  await page.getByLabel("Correo electrónico (requerido)").fill(email);
  await page.getByLabel("Teléfono (requerido)").fill("+56 9 1111 1111");
}

test("adds from results and detail, preserves the cart, and reviews/removes selected rooms", async ({
  page,
}) => {
  page.on("console", (message) => {
    if (message.type() === "error")
      console.error(`[browser] ${message.text()}`);
  });
  await page.goto(`/disponibilidad?${resultQuery}`);
  const addFromResults = page
    .getByRole("button", { name: "Agregar a la reserva" })
    .first();
  await addFromResults.focus();
  await expect(addFromResults).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/rooms=habitacion-valle-demo/);
  await expect(page.getByLabel("Carro de reserva")).toContainText(
    "1 ítem agregado"
  );

  await page.getByRole("link", { name: "Ver habitación" }).nth(2).click();
  await expect(page).toHaveURL(/habitacion-terra-demo/);
  await expect(page).toHaveURL(/rooms=habitacion-valle-demo/);
  await expect(page.getByLabel("Carro de reserva")).toBeVisible();
  await page.getByRole("button", { name: "Agregar a la reserva" }).click();
  await expect(page).toHaveURL(
    /rooms=habitacion-terra-demo%2Chabitacion-valle-demo/
  );
  await expect(page.getByLabel("Carro de reserva")).toContainText(
    "2 ítems agregados"
  );

  const reviewLink = page.getByRole("link", { name: /Ver carrito/ });
  await reviewLink.focus();
  await expect(reviewLink).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/pre-reserva\?/);
  await expect(
    page.getByRole("heading", { name: "Revisa tu reserva" })
  ).toBeVisible();
  await expect(page.getByText("$375.000")).toBeVisible();
  await page
    .getByRole("button", { name: "Quitar Habitación Doble de la reserva" })
    .click();
  await expect(page).toHaveURL(/rooms=habitacion-valle-demo/);
  await expect(page.getByText("$165.000")).toHaveCount(2);
});

test("uses live feedback without travel animation when reduced motion is requested", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/habitaciones/habitacion-valle-demo?${resultQuery}`);
  await page.getByRole("button", { name: "Agregar a la reserva" }).click();

  await expect(page).toHaveURL(/rooms=habitacion-valle-demo/);
  await expect(page.getByText("Ya se encuentra agregada")).toBeVisible();
  await expect(page.locator("[data-cart-animation]")).toHaveCount(0);
});

test("keeps an active session selection when returning home and adding another room", async ({
  page,
}) => {
  await page.goto(`/disponibilidad?${resultQuery}`);
  await page
    .getByRole("button", { name: "Agregar a la reserva" })
    .first()
    .click();
  await expect(page.getByLabel("Carro de reserva")).toContainText(
    "1 ítem agregado"
  );

  await page.goto("/");
  const search = page.getByRole("form", { name: "Consulta de disponibilidad" });
  await expect(search.getByLabel("Fecha de entrada")).toHaveValue("2061-02-10");
  await expect(search.getByLabel("Fecha de salida")).toHaveValue("2061-02-13");
  await search
    .getByRole("button", { name: "Consultar disponibilidad" })
    .click();
  await expect(page).toHaveURL(/rooms=habitacion-valle-demo/);

  await page
    .getByRole("button", { name: "Agregar a la reserva" })
    .first()
    .click();
  await expect(page.getByLabel("Carro de reserva")).toContainText(
    "2 ítems agregados"
  );

  await page.goto("/pre-reserva");
  await expect(
    page.getByRole("heading", { name: "Revisa tu reserva" })
  ).toBeVisible();
  await expect(page.getByText("Habitaciones seleccionadas")).toBeVisible();
});

test("does not expose a detail add control without an effective date range", async ({
  page,
}) => {
  await page.goto("/habitaciones/habitacion-valle-demo");
  await expect(
    page.getByRole("link", { name: "Consultar disponibilidad" }).first()
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Agregar a la reserva" })
  ).toHaveCount(0);
});

test("shows selected controls and expands multi-room cart details accessibly", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    window.sessionStorage.setItem(
      "vista-valle.public-room-selection.v1",
      JSON.stringify({
        checkIn: "2061-02-10",
        checkOut: "2061-02-13",
        rooms: [],
      })
    );
    window.dispatchEvent(new Event("vista-valle:room-selection-change"));
  });
  await page.goto(`/disponibilidad?${resultQuery}`);
  await page
    .getByRole("button", { name: "Agregar a la reserva" })
    .first()
    .click();
  await expect(
    page.getByText("Ya se encuentra agregada").first()
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Quitar de la reserva" })
    .first()
    .click();
  await expect(
    page.getByRole("button", { name: "Agregar a la reserva" }).first()
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Agregar a la reserva" })
    .first()
    .click();
  await expect(
    page.getByText("Ya se encuentra agregada").first()
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Agregar a la reserva" })
    .first()
    .click();
  await expect(page.getByText("Ya se encuentra agregada")).toHaveCount(2);

  const summary = page.getByRole("button", { name: /2 ítems agregados/ });
  await summary.focus();
  await page.keyboard.press("Enter");
  await expect(summary).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#reservation-cart-items")).toContainText("noches");
  await page.keyboard.press("Escape");
  await expect(summary).toHaveAttribute("aria-expanded", "false");
  await summary.click();
  await page.mouse.click(4, 4);
  await expect(summary).toHaveAttribute("aria-expanded", "false");
});

test("removes cart items by keyboard and hides the cart after the last room", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto(
    `/disponibilidad?${resultQuery}&rooms=habitacion-valle-demo%2Chabitacion-andes-demo`
  );
  const summary = page.getByRole("button", { name: /2 ítems agregados/ });
  await summary.click();
  const remove = page
    .getByRole("button", { name: /Quitar .* de la reserva/ })
    .first();
  await remove.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Carro de reserva")).toContainText(
    "1 ítem agregado"
  );
  await page.getByRole("button", { name: /1 ítem agregado/ }).click();
  await page
    .getByRole("button", { name: /Quitar .* de la reserva/ })
    .press("Enter");
  await expect(page.getByLabel("Carro de reserva")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
});

test("reflows the active cart capsule without overflow on phone and desktop", async ({
  page,
}) => {
  for (const viewport of [
    { width: 320, height: 800 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await page.evaluate(() => window.sessionStorage.clear());
    await page.goto(`/disponibilidad?${resultQuery}`);
    await page
      .getByRole("button", { name: "Agregar a la reserva" })
      .first()
      .click();

    const cart = page.getByLabel("Carro de reserva");
    await expect(cart).toBeVisible();
    await expect(cart.getByRole("link", { name: /Ver carrito/ })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);

    const summaryBorder = await page
      .locator('[data-cart-zone="summary"]')
      .evaluate((element) => getComputedStyle(element).borderLeftWidth);
    expect(summaryBorder).toBe(viewport.width === 320 ? "0px" : "1px");
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

test("confirms the no-invoice path with the server-derived total", async ({
  page,
}) => {
  await page.goto(`/pre-reserva?${resultQuery}&rooms=habitacion-valle-demo`);
  await expect(page.getByText("$165.000")).toHaveCount(2);
  await fillGuest(page, "ana-no-invoice@example.test");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/Datos de huésped validados/)).toBeVisible();
  const confirmation = page.waitForResponse("**/api/bookings/pay-at-property");
  await page
    .getByRole("button", { name: "Confirmar reserva y pagar al llegar" })
    .click();
  expect((await confirmation).status()).toBe(201);

  await expect(page).toHaveURL(/\/reserva\/VV-/);
  await expect(page.getByText("$165.000")).toBeVisible();
  expect(
    await page.evaluate(() =>
      window.sessionStorage.getItem("vista-valle.public-room-selection.v1")
    )
  ).toBeNull();
});

test("requires valid invoice data before confirming the multi-room total", async ({
  page,
}) => {
  await page.goto(
    `/pre-reserva?checkIn=2062-02-10&checkOut=2062-02-13&guests=1&rooms=habitacion-valle-demo%2Chabitacion-andes-demo`
  );
  await expect(page.getByText("$345.000")).toBeVisible();
  await fillGuest(page, "ana-invoice@example.test");
  await page.getByLabel("Solicitar factura").check();
  await page.getByLabel(/Nombre o razón social/).fill("Empresa Demo");
  await page.getByLabel(/^RUT/).fill("76.000.543-2");
  await page
    .getByLabel("Teléfono de contacto (requerido)")
    .fill("+56 9 2222 2222");
  await page.getByLabel("Giro (requerido)").fill("Hospedaje");
  await page
    .getByLabel("Correo de facturación (requerido)")
    .fill("facturas@example.test");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(
    page.getByRole("form", { name: "Datos del huésped" }).getByRole("alert")
  ).toContainText("Ingresa un RUT chileno válido.");

  await page.getByLabel(/^RUT/).fill("76.000.543-6");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/Datos de huésped validados/)).toBeVisible();
  const confirmation = page.waitForResponse("**/api/bookings/pay-at-property");
  await page
    .getByRole("button", { name: "Confirmar reserva y pagar al llegar" })
    .click();
  expect((await confirmation).status()).toBe(201);

  await expect(page).toHaveURL(/\/reserva\/VV-/);
  await expect(page.getByText("$345.000")).toBeVisible();
});

test("keeps the prebooking review accessible and without horizontal overflow on phone and desktop", async ({
  page,
}) => {
  for (const viewport of [
    { width: 320, height: 800 },
    { width: 1440, height: 1000 },
  ]) {
    await page.setViewportSize(viewport);
    await page.goto(`/pre-reserva?${resultQuery}&rooms=habitacion-valle-demo`);
    await expect(page.getByRole("main")).toBeVisible();
    const dateSummary = page.getByLabel("Fechas de la reserva");
    await expect(dateSummary).toContainText("Entrada");
    await expect(dateSummary).toContainText("Salida");
    await expect(dateSummary).toHaveClass(/bg-card/);
    await expect(dateSummary).toHaveClass(/shadow-md/);
    await expect(
      page.getByRole("button", { name: /actualizar|editar.*fecha/i })
    ).toHaveCount(0);
    await expect(
      page.getByRole("textbox", { name: /Entrada|Salida/ })
    ).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth
      )
    ).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});
