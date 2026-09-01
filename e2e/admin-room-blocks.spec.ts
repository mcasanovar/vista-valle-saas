import { expect, test } from "@playwright/test";

// The mock database is process-global, so parallel browser workers would race
// while mutating it even though each scenario uses separate lodging dates.
test.describe.configure({ mode: "serial" });

async function openMockAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.getByRole("link", { name: "Abrir panel de desarrollo" }).click();
}

test("mock administrator creates multiple room blocks and confirms removal", async ({ page }) => {
  await openMockAdmin(page);
  await page.goto("/admin/calendario?checkIn=2058-01-10&roomId=demo-room-valle");
  await page.getByRole("button", { name: "Crear reserva o bloqueo para Habitación Individual el 2058-01-10" }).click();
  await page.getByRole("link", { name: /nuevo bloqueo/i }).first().click();
  const form = page.getByRole("form", { name: "Crear bloqueos" });
  await expect(form.getByLabel(/individual/i)).toBeChecked();
  await form.getByLabel(/matrimonial/i).check();
  await form.getByLabel("Entrada").fill("2058-01-10");
  await form.getByLabel("Salida").fill("2058-01-12");
  await form.getByLabel("Motivo sugerido").selectOption("Otro");
  await form.getByLabel("Motivo libre").fill("Mantención E2E");
  await form.getByRole("button", { name: "Crear bloqueos" }).click();
  await expect(page.getByRole("status")).toHaveText(/(?=.*Individual)(?=.*Matrimonial)/);
  await form.getByRole("button", { name: "Crear bloqueos" }).click();
  const duplicateDialog = page.getByRole("dialog", {
    name: "Confirmar conflictos de bloqueo",
  });
  await expect(duplicateDialog).toBeVisible();
  await duplicateDialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(duplicateDialog).toBeHidden();
  await page.getByRole("link", { name: "Limpiar filtros" }).click();
  const createdRows = page.getByRole("listitem").filter({ hasText: "2058-01-10" });
  await expect(createdRows).toHaveCount(2);
  await expect(createdRows.first()).toContainText("creado 2026-09-01");
  await expect(createdRows).toHaveCount(2);
  const row = page
    .getByRole("listitem")
    .filter({ hasText: "2058-01-10" })
    .filter({ hasText: "Habitación Individual" });
  await row.getByRole("button", { name: "Retirar" }).click();
  await row.getByRole("button", { name: "Cancelar" }).click();
  await expect(row.getByRole("button", { name: "Retirar" })).toBeVisible();
  await row.getByRole("button", { name: "Retirar" }).click();
  await row.getByRole("button", { name: "Confirmar retiro" }).click();
  const filterForm = page.getByRole("form", { name: "Filtrar bloqueos" });
  await filterForm.getByLabel("Estado").selectOption("all");
  await filterForm.getByRole("button", { name: "Filtrar" }).click();
  const removedRow = page
    .getByRole("listitem")
    .filter({ hasText: "2058-01-10" })
    .filter({ hasText: "Habitación Individual" });
  await expect(removedRow).toContainText(/retirado por/i);
});

test("mock administrator creates one room block", async ({ page }) => {
  await openMockAdmin(page);
  await page.goto("/admin/bloqueos");
  const form = page.getByRole("form", { name: "Crear bloqueos" });
  await form.getByLabel(/individual/i).check();
  await form.getByLabel("Entrada").fill("2058-03-10");
  await form.getByLabel("Salida").fill("2058-03-12");
  await form.getByRole("button", { name: "Crear bloqueos" }).click();

  await expect(page.getByRole("status")).toHaveText(
    "Bloqueos creados: Habitación Individual."
  );
  const row = page.getByRole("listitem").filter({ hasText: "2058-03-10" });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText("Habitación Individual");
  await expect(row).toContainText("Mantención");
});

test("confirming a block with a conflicting reservation shows the affected day and room, cancel leaves no block, and confirming creates all three without altering the reservation", async ({
  page,
}) => {
  await openMockAdmin(page);

  // Seed a reservation on demo-room-andes ("Matrimonial") that will overlap
  // the manual block interval below.
  await page.goto("/admin/reservas/nueva");
  const reservationForm = page.getByRole("form", {
    name: "Crear reserva manual",
  });
  await reservationForm.getByLabel("Entrada").fill("2059-04-10");
  await reservationForm.getByLabel("Salida").fill("2059-04-12");
  await reservationForm.getByLabel(/matrimonial/i).check();
  await reservationForm.getByLabel("Nombre").fill("Conflicto");
  await reservationForm.getByLabel("Apellido").fill("E2E");
  await reservationForm
    .getByLabel("Correo electrónico")
    .fill("conflicto-e2e@example.test");
  await reservationForm.getByLabel("Teléfono").fill("123");
  await reservationForm.getByRole("button", { name: "Crear reserva" }).click();
  await expect(reservationForm.getByRole("status")).toContainText(
    "Reserva creada."
  );

  await page.goto("/admin/bloqueos");
  const form = page.getByRole("form", { name: "Crear bloqueos" });
  await form.getByLabel(/individual/i).check();
  await form.getByLabel(/matrimonial/i).check();
  await form.getByLabel(/doble/i).check();
  await form.getByLabel("Entrada").fill("2059-04-10");
  await form.getByLabel("Salida").fill("2059-04-12");
  await form.getByLabel("Motivo sugerido").selectOption("Otro");
  await form.getByLabel("Motivo libre").fill("Conflicto E2E");

  await form.getByRole("button", { name: "Crear bloqueos" }).click();
  const dialog = page.getByRole("dialog", {
    name: "Confirmar conflictos de bloqueo",
  });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("2059-04-10");
  await expect(dialog).toContainText("2059-04-11");
  await expect(dialog).toContainText("Habitación Matrimonial");
  await expect(dialog).not.toContainText("Habitación Individual");
  await expect(dialog).not.toContainText("Habitación Doble");

  // Cancelling the review must not create any block.
  await dialog.getByRole("button", { name: "Cancelar" }).click();
  await expect(dialog).toBeHidden();
  await page.goto(
    "/admin/bloqueos?status=all&checkIn=2059-04-10&checkOut=2059-04-12"
  );
  await expect(
    page.getByRole("listitem").filter({ hasText: "2059-04-10" })
  ).toHaveCount(0);

  // Re-run and confirm explicitly: all three rooms get blocked despite the
  // conflict, and the reservation is left untouched.
  await page.goto("/admin/bloqueos");
  const retryForm = page.getByRole("form", { name: "Crear bloqueos" });
  await retryForm.getByLabel(/individual/i).check();
  await retryForm.getByLabel(/matrimonial/i).check();
  await retryForm.getByLabel(/doble/i).check();
  await retryForm.getByLabel("Entrada").fill("2059-04-10");
  await retryForm.getByLabel("Salida").fill("2059-04-12");
  await retryForm.getByLabel("Motivo sugerido").selectOption("Otro");
  await retryForm.getByLabel("Motivo libre").fill("Conflicto E2E");
  await retryForm.getByRole("button", { name: "Crear bloqueos" }).click();
  const retryDialog = page.getByRole("dialog", {
    name: "Confirmar conflictos de bloqueo",
  });
  await expect(retryDialog).toBeVisible();
  await retryDialog.getByRole("button", { name: "Confirmar bloqueo" }).click();
  await expect(page.getByRole("status")).toHaveText("Bloqueos confirmados.");

  await page.goto(
    "/admin/bloqueos?status=all&checkIn=2059-04-10&checkOut=2059-04-12"
  );
  await expect(
    page.getByRole("listitem").filter({ hasText: "2059-04-10" })
  ).toHaveCount(3);

  await page.goto("/admin/reservas");
  await expect(
    page
      .locator("tbody tr")
      .filter({ hasText: "2059-04-10" })
      .filter({ hasText: "2059-04-12" })
  ).toHaveCount(1);
});

for (const viewport of [{ width: 375, height: 812 }, { width: 768, height: 1024 }, { width: 1440, height: 900 }]) {
  test(`room block controls remain available at ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openMockAdmin(page);
    await page.goto("/admin/bloqueos?roomId=demo-room-valle&checkIn=2058-02-10&checkOut=2058-02-12");
    const form = page.getByRole("form", { name: "Crear bloqueos" });
    await expect(form.getByLabel(/individual/i)).toBeChecked();
    await expect(form.getByLabel("Entrada")).toHaveValue("2058-02-10");
    await expect(page.getByRole("form", { name: "Filtrar bloqueos" })).toBeVisible();
  });
}
