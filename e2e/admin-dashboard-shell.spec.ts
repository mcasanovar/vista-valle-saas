import { expect, test } from "@playwright/test";

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
