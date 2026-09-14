import { expect, test, type Page } from "@playwright/test";

// The database is process-global for the mock administrator session, so
// parallel workers would race while mutating the same reservation.
test.describe.configure({ mode: "serial" });

async function openAdmin(page: Page) {
  await page.goto("/admin/login");
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Resumen operativo" })
  ).toBeVisible();
}

async function createManualReservation(
  page: Page,
  params: Readonly<{ checkIn: string; checkOut: string; email: string }>
) {
  await page.getByRole("link", { name: "Nueva reserva" }).click();
  const form = page.getByRole("form", { name: "Crear reserva manual" });
  await form.getByLabel("Origen").selectOption("phone");
  await form.getByLabel("Entrada").fill(params.checkIn);
  await form.getByLabel("Salida").fill(params.checkOut);
  await form.getByRole("checkbox", { name: /individual/i }).check();
  await form.getByLabel("Nombre").fill("Prueba");
  await form.getByLabel("Apellido").fill("Edición fechas");
  await form.getByLabel("Correo").fill(params.email);
  await form.getByRole("textbox", { name: "Teléfono" }).fill("123");
  await form.getByLabel("Huéspedes").fill("1");
  await form.getByRole("button", { name: "Crear reserva" }).click();
  await expect(form.getByRole("status")).toContainText("Reserva creada.");

  await page.goto("/admin/reservas");
  const row = page
    .locator("tbody tr")
    .filter({ hasText: params.checkIn })
    .filter({ hasText: params.checkOut });
  await expect(row).toHaveCount(1);
  await row.getByRole("link", { name: /Ver reserva/ }).click();
}

async function submitDateEdit(page: Page, checkIn: string, checkOut: string) {
  const form = page.getByRole("form", { name: "Editar fechas de la reserva" });
  await form.getByLabel("Nueva entrada").fill(checkIn);
  await form.getByLabel("Nueva salida").fill(checkOut);
  await form.getByRole("button", { name: "Editar fechas" }).click();
  await page
    .getByRole("dialog", { name: "Confirmar edición de fechas" })
    .getByRole("button", { name: "Confirmar cambio de fechas" })
    .click();
  await expect(form.getByRole("status")).toHaveText("Fechas actualizadas.");
}

test("mock administrator extends an unpaid reservation and sees the recalculated total", async ({
  page,
}) => {
  await openAdmin(page);
  await createManualReservation(page, {
    checkIn: "2057-09-10",
    checkOut: "2057-09-12",
    email: "edit-dates-unpaid@example.test",
  });

  const initialTotal = await page
    .getByRole("form", { name: "Registrar cobro presencial" })
    .getByLabel("Monto")
    .inputValue();

  await submitDateEdit(page, "2057-09-10", "2057-09-15");
  await page.reload();

  await expect(page.getByText("2057-09-10 a 2057-09-15")).toBeVisible();
  const updatedTotal = await page
    .getByRole("form", { name: "Registrar cobro presencial" })
    .getByLabel("Monto")
    .inputValue();
  expect(Number(updatedTotal)).toBeGreaterThan(Number(initialTotal));

  await expect(page.getByText("reservation.dates_changed")).toBeVisible();
});

test("mock administrator extends a paid reservation and creates a separate pending balance", async ({
  page,
}) => {
  await openAdmin(page);
  await createManualReservation(page, {
    checkIn: "2057-10-10",
    checkOut: "2057-10-12",
    email: "edit-dates-paid@example.test",
  });

  const collection = page.getByRole("form", {
    name: "Registrar cobro presencial",
  });
  await collection.getByLabel("Fecha").fill("2057-10-10");
  await collection.getByLabel("Medio").fill("cash");
  await collection.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(collection.getByRole("status")).toHaveText(
    "Cobro registrado."
  );
  await page.reload();

  await submitDateEdit(page, "2057-10-10", "2057-10-14");
  await page.reload();

  await expect(page.getByText("2057-10-10 a 2057-10-14")).toBeVisible();
  await expect(page.getByText(/^Estado: approved/)).toBeVisible();
  await expect(page.getByText(/^Estado: pending/)).toBeVisible();
});

test("mock administrator reduces a paid reservation and sees the overpayment alert", async ({
  page,
}) => {
  await openAdmin(page);
  await createManualReservation(page, {
    checkIn: "2057-11-10",
    checkOut: "2057-11-15",
    email: "edit-dates-overpaid@example.test",
  });

  const collection = page.getByRole("form", {
    name: "Registrar cobro presencial",
  });
  await collection.getByLabel("Fecha").fill("2057-11-10");
  await collection.getByLabel("Medio").fill("cash");
  await collection.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(collection.getByRole("status")).toHaveText(
    "Cobro registrado."
  );
  await page.reload();

  await submitDateEdit(page, "2057-11-10", "2057-11-12");
  await page.reload();

  await expect(page.getByText("2057-11-10 a 2057-11-12")).toBeVisible();
  await expect(page.getByRole("alert").filter({ hasText: "sobrepago" })).toBeVisible();
});
