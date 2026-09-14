import { expect, test } from "@playwright/test";

// The mock room-pricing repository is process-global (see
// admin-room-blocks.spec.ts's note on the mock database), and this file
// edits Habitación Individual's tariff specifically so it never collides
// with the Doble/Matrimonial prices other specs assert on.
test.describe.configure({ mode: "serial" });

async function openMockAdmin(page: import("@playwright/test").Page) {
  await page.goto("/admin/login");
  await page.getByRole("link", { name: "Abrir panel de desarrollo" }).click();
}

test("mock administrator edits a room's tariff and the public search reflects it immediately", async ({
  page,
}) => {
  await openMockAdmin(page);
  await page.goto("/admin/habitaciones/demo-room-valle/tarifas");
  await expect(
    page.getByRole("heading", { name: "Tarifas de Habitación Individual" })
  ).toBeVisible();
  const priceField = page.getByLabel("Precio por noche");
  await expect(priceField).toHaveValue("55000");
  await priceField.fill("58000");
  await page.getByRole("button", { name: "Guardar tarifas" }).click();
  await expect(page.getByText("La tarifa se actualizó correctamente.")).toBeVisible();

  await page.goto(
    "/disponibilidad?checkIn=2059-04-01&checkOut=2059-04-03&guests=1"
  );
  await expect(page.getByText("$58.000")).toBeVisible();
});
