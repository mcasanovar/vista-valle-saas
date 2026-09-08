import { expect, test } from "@playwright/test";

test("admin dashboard summary responds to the month selector while alerts and recent reservations stay put", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  // The configured mock adapter supplies the authorized administrator session.
  await page.goto("/admin/login");
  await page.goto("/admin?year=2026&month=2026-10");
  await expect(page.getByLabel("Mes").last()).toHaveValue("2026-10");

  const reservationsCard = page.locator("article", {
    hasText: "Reservas del mes",
  });
  await expect(reservationsCard).toContainText("1");

  const alertsCard = page.locator("article", { hasText: "Alertas abiertas" });
  const alertsBeforeText = await alertsCard.textContent();
  await expect(page.getByText("Huésped demo").first()).toBeVisible();

  await page.getByLabel("Mes").last().selectOption("2026-11");

  await expect(page).toHaveURL(/year=2026&month=2026-11/);
  await expect(reservationsCard).toContainText("0");
  await expect(alertsCard).toHaveText(alertsBeforeText ?? "");
  await expect(page.getByText("Huésped demo").first()).toBeVisible();
});

test("admin dashboard year selector shows the full year, drills into a month, and returns to the full year", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin/login");
  await page.goto("/admin?year=2026");

  await expect(page.getByLabel("Mes").last()).toHaveValue("");
  const reservationsCard = page.locator("article", {
    hasText: "Reservas del año",
  });
  await expect(reservationsCard).toContainText("1");

  await page.getByLabel("Año siguiente").last().click();
  await expect(page).toHaveURL(/year=2027(?!.*month)/);
  await expect(page.getByLabel("Mes").last()).toHaveValue("");
  await expect(
    page.locator("article", { hasText: "Reservas del año" })
  ).toContainText("0");

  await page.getByLabel("Año anterior").last().click();
  await expect(page).toHaveURL(/year=2026(?!.*month)/);

  await page.getByLabel("Mes").last().selectOption("2026-10");
  await expect(page).toHaveURL(/year=2026&month=2026-10/);
  await expect(
    page.locator("article", { hasText: "Reservas del mes" })
  ).toContainText("1");

  await page.getByLabel("Mes").last().selectOption("");
  await expect(page).toHaveURL(/year=2026(?!.*month)/);
  await expect(reservationsCard).toContainText("1");
});

test("admin shell adapts the authenticated dashboard at desktop, tablet and mobile widths", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Resumen operativo" })
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Navegación administrativa" })
  ).toBeVisible();
  await expect(page.locator('[data-theme="admin"]')).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Resumen" }).first()
  ).toHaveAttribute("aria-current", "page");

  await page.setViewportSize({ width: 834, height: 1194 });
  const compact = page.getByRole("navigation", {
    name: "Navegación administrativa compacta",
  });
  await expect(compact).toBeVisible();
  for (const label of [
    "Resumen",
    "Calendario",
    "Reservas",
    "Nueva reserva",
    "Bloqueos",
    "Sincronizaciones",
    "Alertas",
    "Asistente",
  ]) {
    await expect(compact.getByRole("link", { name: label })).toBeVisible();
  }

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileNav = page.getByRole("navigation", {
    name: "Navegación administrativa móvil",
  });
  await expect(mobileNav).toBeVisible();
  await expect(mobileNav).toHaveCSS("position", "fixed");
  await expect(mobileNav).toContainText("Resumen");
  await expect(mobileNav).toContainText("Calendario");
  await expect(mobileNav).toContainText("Reservas");
  await expect(mobileNav).toContainText("Alertas");
  await expect(mobileNav).toContainText("Más");
  await mobileNav.getByText("Más").click();
  await expect(mobileNav.getByRole("link", { name: "Bloqueos" })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect(mobileNav).toBeVisible();
});
