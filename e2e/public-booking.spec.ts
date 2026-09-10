import { expect, test } from "@playwright/test";

test("searches from the home, reviews results, and preserves criteria in room detail", async ({
  page,
}) => {
  const externalRequests: string[] = [];
  page.on("request", (request) => {
    const hostname = new URL(request.url()).hostname;
    if (hostname !== "127.0.0.1" && hostname !== "localhost")
      externalRequests.push(request.url());
  });
  await page.goto("/");
  const search = page.getByRole("form", { name: "Consulta de disponibilidad" });
  await search.getByLabel("Fecha de entrada").fill("2027-01-01");
  await search.getByLabel("Fecha de salida").fill("2027-01-03");
  await expect(search.getByLabel("Fecha de entrada")).toHaveValue("2027-01-01");
  await expect(search.getByLabel("Fecha de salida")).toHaveValue("2027-01-03");
  await search.getByRole("button", { name: "Aumentar Huéspedes" }).click();
  await search
    .getByRole("button", { name: "Consultar disponibilidad" })
    .click();
  await expect(page).toHaveURL(/\/disponibilidad\?checkIn=2027-01-01/);
  await expect(page).toHaveURL(/checkOut=2027-01-03/);
  await expect(page).toHaveURL(/guests=2/);
  await expect(
    page.getByRole("heading", { level: 1, name: "Disponibilidad" })
  ).toBeVisible();
  // guests=2 no longer excludes single-capacity rooms - all 3 demo rooms
  // remain candidates so the party can split across them.
  await expect(page.getByText("3 habitaciones disponibles")).toBeVisible();
  await page.getByRole("link", { name: "Ver habitación" }).first().click();
  await expect(page).toHaveURL(/\/habitaciones\/[^?]+\?checkIn=2027-01-01/);
  await expect(page).toHaveURL(/checkOut=2027-01-03/);
  await expect(page).toHaveURL(/guests=2/);
  await expect(page).toHaveURL(/room=/);
  expect(externalRequests).toEqual([]);
});

test("adds multiple rooms from results and shows shared-date aggregate selection", async ({
  page,
}) => {
  await page.goto(
    "/disponibilidad?checkIn=2055-02-01&checkOut=2055-02-03&guests=1"
  );
  await page
    .getByRole("button", { name: "Agregar a la reserva" })
    .nth(0)
    .click();
  await expect(page).toHaveURL(/rooms=/);
  await expect(page.getByLabel("Carro de reserva")).toBeVisible();
  await expect(page.getByRole("link", { name: /Ver carrito/ })).toBeVisible();
});

test("keeps invalid direct URLs recoverable and does not show results", async ({
  page,
}) => {
  await page.goto("/disponibilidad?checkIn=2055-01-03&guests=0");
  await expect(page.getByText("Revisa tu consulta")).toBeVisible();
  await expect(page.getByText("Indica la fecha de salida.")).toBeVisible();
  await expect(page.getByText("Indica entre 1 y 20 huéspedes.")).toBeVisible();
  await expect(
    page.getByRole("region", { name: "Resultados de disponibilidad" })
  ).not.toBeVisible();
});

test("lists every room for a party larger than any single room's capacity, and treats an unresolvable preselection as unavailable", async ({
  page,
}) => {
  // No single demo room admits 20 guests, but the search no longer filters
  // by total party capacity: all 3 remain candidates for the visitor to
  // split the party across.
  await page.goto(
    "/disponibilidad?checkIn=2055-01-01&checkOut=2055-01-03&guests=20"
  );
  await expect(page.getByText("3 habitaciones disponibles")).toBeVisible();
  await page.goto(
    "/disponibilidad?checkIn=2055-01-01&checkOut=2055-01-03&guests=1&room=habitacion-inexistente"
  );
  await expect(
    page.getByText("Habitación no disponible").first()
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Quitar preselección" })
  ).toBeVisible();
});

test("splits a 2-guest search across two rooms and prices each by its own occupancy", async ({
  page,
}) => {
  await page.goto(
    "/disponibilidad?checkIn=2055-03-01&checkOut=2055-03-03&guests=2"
  );
  const dobleCard = page
    .locator(".vv-room-card")
    .filter({ hasText: "Habitación Doble" });
  await dobleCard
    .getByRole("group", { name: "Cantidad de personas" })
    .getByRole("button", { name: "1 persona" })
    .click();
  await dobleCard.getByRole("button", { name: "Agregar a la reserva" }).click();
  const allocationBanner = page.locator("p", {
    hasText: "Huéspedes asignados:",
  });
  await expect(allocationBanner).toHaveText(
    "Huéspedes asignados: 1 de 2. Falta 1 por asignar."
  );

  const matrimonialCard = page
    .locator(".vv-room-card")
    .filter({ hasText: "Habitación Matrimonial" });
  await matrimonialCard
    .getByRole("button", { name: "Agregar a la reserva" })
    .click();
  await expect(allocationBanner).toHaveText(
    "Huéspedes asignados: 2 de 2. Reparto completo."
  );

  await page.getByRole("link", { name: /Ver carrito/ }).click();
  await expect(page).toHaveURL(/\/pre-reserva/);
  // Doble priced at its 1-guest tariff (55.000, not the base/2-guest
  // 70.000) plus Matrimonial's flat price (60.000, no tariff configured
  // yet) — 2 nights each: (55.000 + 60.000) * 2 = 230.000.
  await expect(page.getByText("$230.000")).toBeVisible();
});

test("restores previous valid search with browser history", async ({
  page,
}) => {
  await page.goto(
    "/disponibilidad?checkIn=2055-01-01&checkOut=2055-01-03&guests=1"
  );
  await expect(page.getByLabel("Huéspedes: 1")).toBeVisible();
  await page.getByRole("button", { name: "Aumentar Huéspedes" }).click();
  await page.getByRole("button", { name: "Consultar disponibilidad" }).click();
  await expect(page).toHaveURL(/guests=2/);
  await page.goBack();
  await expect(page).toHaveURL(/guests=1/);
  await expect(page.getByLabel("Huéspedes: 1")).toBeVisible();
});

test("announces in-page loading and keeps the search shell visible", async ({
  page,
}) => {
  await page.goto(
    "/disponibilidad?checkIn=2055-01-01&checkOut=2055-01-03&guests=1"
  );
  await page.getByRole("button", { name: "Aumentar Huéspedes" }).click();
  await page.getByRole("button", { name: "Consultar disponibilidad" }).click();
  await expect(
    page.getByRole("form", { name: "Consulta de disponibilidad" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Consultar disponibilidad" })
  ).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText("3 habitaciones disponibles")).toBeVisible();
});

test("shows a recoverable error when a results navigation fails", async ({
  page,
}) => {
  await page.goto(
    "/disponibilidad?checkIn=2055-01-01&checkOut=2055-01-03&guests=1&_testAvailabilityError=1"
  );
  await expect(
    page.getByText("No pudimos consultar disponibilidad")
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Reintentar" })).toHaveAttribute(
    "href",
    /\/disponibilidad\?checkIn=/
  );
  await page.getByRole("link", { name: "Reintentar" }).click();
  await expect(page.getByText("3 habitaciones disponibles")).toBeVisible();
});
