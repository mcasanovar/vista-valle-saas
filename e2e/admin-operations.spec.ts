import { expect, test, type Page } from "@playwright/test";

async function createWebsiteReservation(page: Page) {
  await page.goto("/?room=habitacion-terra-demo#consulta-disponibilidad");

  const search = page.getByRole("form", {
    name: "Consulta de disponibilidad",
  });
  await search.getByLabel("Fecha de entrada").fill("2056-08-10");
  await search.getByLabel("Fecha de salida").fill("2056-08-12");
  await search.getByRole("button", { name: "Aumentar Huéspedes" }).click();
  await search
    .getByRole("button", { name: "Consultar disponibilidad" })
    .click();
  await expect(page).toHaveURL(/\/disponibilidad\?/);
  await expect(
    page.getByRole("region", { name: "Resultados de disponibilidad" })
  ).toBeVisible();
  // The guest and summary steps live on the home booking flow; availability
  // is a separate results page, so carry the validated criteria forward.
  await page.goto(
    "/?checkIn=2056-08-10&checkOut=2056-08-12&guests=2&room=habitacion-terra-demo#datos-huesped"
  );

  const guest = page.getByRole("form", { name: "Datos del huésped" });
  await guest.locator('[name="firstName"]').fill("Prueba");
  await guest.locator('[name="lastName"]').fill("Operativa");
  await guest.locator('[name="email"]').fill("web-e2e@example.test");
  await guest.locator('[name="phone"]').fill("123");
  await guest.getByRole("button", { name: "Continuar" }).click();

  const summary = page.getByRole("region", { name: "Resumen de reserva" });
  const summaryButton = summary.getByRole("button", { name: "Ver resumen" });
  await expect(summaryButton).toBeEnabled();
  await summaryButton.click();
  const confirm = summary.getByRole("button", {
    name: "Confirmar reserva y pagar al llegar",
  });
  await expect(confirm).toBeEnabled({ timeout: 15000 });
  await confirm.click();
  await expect(page).toHaveURL(/\/reserva\/VV-[0-9a-f-]{36}$/, {
    timeout: 15000,
  });
}

test("mock administrator operates external reservations, blocks, collection, and channel sync", async ({
  page,
}) => {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    const hostname = new URL(request.url()).hostname;
    if (hostname !== "127.0.0.1" && hostname !== "localhost") {
      providerRequests.push(request.url());
    }
  });

  // The configured mock adapter supplies the authorized administrator session.
  await page.goto("/admin/login");
  await expect(
    page.getByRole("heading", { name: "Acceso administrativo" })
  ).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Resumen operativo" })
  ).toBeVisible();
  await expect(page.getByText("mock-admin@example.test")).toBeVisible();

  await page.getByRole("link", { name: "Nueva reserva" }).click();
  const manualReservation = page.getByRole("form", {
    name: "Crear reserva manual",
  });
  await manualReservation.getByLabel("Origen").selectOption("booking");
  await manualReservation.getByLabel("Entrada").fill("2056-06-10");
  await manualReservation.getByLabel("Salida").fill("2056-06-12");
  await manualReservation.getByRole("checkbox", { name: /valle/i }).check();
  await manualReservation.getByLabel("Nombre").fill("Operación");
  await manualReservation.getByLabel("Apellido").fill("E2E");
  await manualReservation.getByLabel("Correo").fill("manual-e2e@example.test");
  await manualReservation.getByLabel("Teléfono").fill("123");
  await manualReservation.getByLabel("Huéspedes").fill("1");
  await manualReservation
    .getByRole("button", { name: "Crear reserva" })
    .click();
  await expect(page.getByRole("status")).toHaveText("Reserva creada.");

  await page.goto("/admin/reservas");
  const reservationRow = page
    .locator("tbody tr")
    .filter({ hasText: "2056-06-10 a 2056-06-12" });
  await expect(reservationRow).toHaveCount(1);
  await expect(reservationRow).toContainText("booking");
  await reservationRow.getByRole("link", { name: /Ver reserva/ }).click();

  const collection = page.getByRole("form", {
    name: "Registrar cobro presencial",
  });
  const total = await collection.getByLabel("Monto").inputValue();
  expect(Number(total)).toBeGreaterThan(0);
  await collection.getByLabel("Fecha").fill("2056-06-10");
  await collection.getByLabel("Medio").fill("cash");
  await collection.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(collection.getByRole("status")).toHaveText("Cobro registrado.");
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("Pago registrado.");

  await page.getByRole("link", { name: "Bloqueos" }).click();
  const blockForm = page.getByRole("form", { name: "Crear bloques" });
  await blockForm.getByLabel("Valle").check();
  await blockForm.getByLabel("Andes").check();
  await blockForm.getByLabel("Entrada").fill("2056-07-10");
  await blockForm.getByLabel("Salida").fill("2056-07-12");
  await blockForm.getByLabel("Motivo sugerido").selectOption("Otro");
  await blockForm.getByLabel("Motivo libre").fill("Mantenimiento E2E");
  await blockForm.getByRole("button", { name: "Crear bloques" }).click();
  await expect(page.getByRole("status")).toHaveText("Bloqueos creados.");
  const activeBlock = page.getByText(
    "demo-room-andes: 2056-07-10 a 2056-07-12"
  );
  await expect(activeBlock).toBeVisible();
  const row = page.getByRole("listitem").filter({ hasText: "2056-07-10 a 2056-07-12" }).first();
  await row.getByRole("button", { name: "Retirar" }).click();
  await row.getByRole("button", { name: "Cancelar" }).click();
  await expect(row).toBeVisible();
  await row.getByRole("button", { name: "Retirar" }).click();
  await row.getByRole("button", { name: "Confirmar retiro" }).click();

  await createWebsiteReservation(page);
  await page.goto("/admin/sincronizaciones");
  await expect(
    page.getByRole("heading", { name: "Sincronizaciones pendientes" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Completar airbnb" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Completar booking" })
  ).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Completar airbnb" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "Sincronización completada."
  );
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Completar booking" }).click();
  await expect(
    page.getByRole("button", { name: "Completar airbnb" })
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Completar booking" })
  ).toHaveCount(0);

  expect(providerRequests).toEqual([]);
});
