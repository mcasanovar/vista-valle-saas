import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const availableRoomsQuery = "checkIn=2055-01-01&checkOut=2055-01-03&guests=1";

test("opens the photo carousel from the home room card and reflects it in the URL", async ({
  page,
}) => {
  await page.goto("/");

  const trigger = page.getByRole("button", {
    name: "Ver fotos de Habitación Individual",
  });
  await trigger.click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/\/\?habitacion=habitacion-valle-demo&foto=1$/);
});

test("opens the photo carousel from the catalogue room card", async ({
  page,
}) => {
  await page.goto("/habitaciones");

  await page
    .getByRole("button", { name: "Ver fotos de Habitación Individual" })
    .click();

  await expect(page).toHaveURL(
    /\/habitaciones\?habitacion=habitacion-valle-demo&foto=1$/
  );
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(
    /\/habitaciones\?habitacion=habitacion-valle-demo&foto=1$/
  );
});

test("opens the photo carousel from availability results", async ({ page }) => {
  await page.goto(`/disponibilidad?${availableRoomsQuery}`);
  const trigger = page.getByRole("button", {
    name: "Ver fotos de Habitación Individual",
  });
  await expect(trigger).toBeVisible();

  await trigger.click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(/habitacion=habitacion-valle-demo/);
  await expect(page).toHaveURL(/foto=1/);
});

test("opens the room detail gallery at the selected photo and navigates with the keyboard", async ({
  page,
}) => {
  await page.goto("/habitaciones/habitacion-valle-demo");

  const secondPhoto = page.getByRole("button", {
    name: /Ver foto 2 de 3/,
  });
  await secondPhoto.click();

  await expect(page).toHaveURL(
    /\/habitaciones\/habitacion-valle-demo\?foto=2$/
  );
  await expect(page.getByRole("dialog")).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(page).toHaveURL(/\?foto=3$/);

  await page.keyboard.press("ArrowLeft");
  await expect(page).toHaveURL(/\?foto=2$/);
});

test("closes the room detail gallery with Escape and returns focus to the trigger", async ({
  page,
}) => {
  await page.goto("/habitaciones/habitacion-valle-demo");

  const firstPhoto = page.getByRole("button", { name: /Ver foto 1 de 3/ });
  await firstPhoto.click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/habitaciones\/habitacion-valle-demo$/);
  await expect(firstPhoto).toBeFocused();
});

test("closes the room detail gallery with the close button", async ({
  page,
}) => {
  await page.goto("/habitaciones/habitacion-valle-demo");

  await page.getByRole("button", { name: /Ver foto 1 de 3/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(page).toHaveURL(/\?foto=1$/);
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "Cerrar" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/habitaciones\/habitacion-valle-demo$/);
});

test("closes the room detail gallery on backdrop click", async ({ page }) => {
  await page.goto("/habitaciones/habitacion-valle-demo");

  await page.getByRole("button", { name: /Ver foto 1 de 3/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(page).toHaveURL(/\?foto=1$/);
  await expect(dialog).toBeVisible();

  await dialog.click({ position: { x: 5, y: 5 } });
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/habitaciones\/habitacion-valle-demo$/);
});

test("closes the room detail gallery when the browser back button is pressed", async ({
  page,
}) => {
  await page.goto("/habitaciones/habitacion-valle-demo");

  await page.getByRole("button", { name: /Ver foto 1 de 3/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\?foto=1$/);

  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/habitaciones\/habitacion-valle-demo$/);
});

test("opens the room detail gallery directly from a shared deep link", async ({
  page,
}) => {
  await page.goto("/habitaciones/habitacion-valle-demo?foto=3");

  await expect(page.getByRole("dialog")).toBeVisible();
});

test("the open photo carousel has no automated accessibility violations", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/habitaciones/habitacion-valle-demo");

  await page.getByRole("button", { name: /Ver foto 1 de 3/ }).click();
  await expect(page.getByRole("dialog")).toBeVisible();

  const results = await new AxeBuilder({ page })
    .include('[role="dialog"]')
    .analyze();
  expect(results.violations).toEqual([]);
});
