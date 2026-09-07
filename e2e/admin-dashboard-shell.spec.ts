import { expect, test } from "@playwright/test";

test("admin dashboard summary responds to the month selector while alerts and recent reservations stay put", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  // The configured mock adapter supplies the authorized administrator session.
  await page.goto("/admin/login");
  await page.goto("/admin?month=2026-10");
  await expect(page.getByText("octubre de 2026").last()).toBeVisible();

  const reservationsCard = page.locator("article", {
    hasText: "Reservas del mes",
  });
  await expect(reservationsCard).toContainText("1");

  const alertsCard = page.locator("article", { hasText: "Alertas abiertas" });
  const alertsBeforeText = await alertsCard.textContent();
  await expect(page.getByText("Huésped demo").first()).toBeVisible();

  await page.getByLabel("Mes siguiente").last().click();

  await expect(page.getByText("noviembre de 2026").last()).toBeVisible();
  await expect(page).toHaveURL(/month=2026-11/);
  await expect(reservationsCard).toContainText("0");
  await expect(alertsCard).toHaveText(alertsBeforeText ?? "");
  await expect(page.getByText("Huésped demo").first()).toBeVisible();
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
