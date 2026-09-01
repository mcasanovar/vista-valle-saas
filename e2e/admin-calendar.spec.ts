import { expect, test } from "@playwright/test";

const octoberUrl = "/admin/calendario?checkIn=2026-10-01&preset=month";

test.describe.configure({ mode: "serial" });

test("loads Mes by default as a classic calendar grid and shows real occupancy", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(octoberUrl);
  await expect(
    page.getByRole("heading", { name: "Calendario por habitación" })
  ).toBeVisible();
  await expect(page.getByLabel("Leyenda")).toBeVisible();
  await expect(page.getByRole("link", { name: "Mes" })).toHaveAttribute(
    "aria-current",
    "true"
  );
  // Classic grid: fixed Monday-to-Sunday columns, one row per week.
  await expect(page.getByText("L", { exact: true })).toBeVisible();
  await expect(page.getByText("D", { exact: true }).first()).toBeVisible();
  // The mock reservation's room shows as a chip inside its day's cell.
  await expect(
    page
      .getByRole("button", { name: "Habitación Individual" })
      .and(page.locator(":visible"))
      .first()
  ).toBeVisible();
});

test("switches preset and granularity via URL-driven navigation", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(octoberUrl);
  await page.getByRole("link", { name: "Próximos 7 días" }).click();
  await expect(page).toHaveURL(/preset=next_7_days/);
  await expect(
    page.getByRole("link", { name: "Próximos 7 días" })
  ).toHaveAttribute("aria-current", "true");

  await page.goto(octoberUrl);
  await page.getByRole("link", { name: "Vista semanal comprimida" }).click();
  await expect(page).toHaveURL(/granularity=weekly/);
  await expect(page.getByRole("columnheader", { name: /Sem 1/ })).toBeVisible();
});

test("uses the classic grid for Semana and 2 semanas too, not just Mes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(octoberUrl);
  await page.getByRole("link", { name: "Semana", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Semana", exact: true })
  ).toHaveAttribute("aria-current", "true");
  await expect(page.getByText("L", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "2 semanas" }).click();
  await expect(
    page.getByRole("link", { name: "2 semanas" })
  ).toHaveAttribute("aria-current", "true");
  await expect(page.getByText("L", { exact: true })).toBeVisible();
});

test("opens quick-create from an empty day cell and the detail panel from an occupied chip", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(octoberUrl);

  await page
    .getByRole("button", { name: "Habitación Individual" })
    .and(page.locator(":visible"))
    .first()
    .click();
  const detailDialog = page.getByRole("dialog");
  await expect(detailDialog).toBeVisible();
  await expect(
    detailDialog.getByRole("link", { name: "Ver reserva completa" })
  ).toHaveAttribute("href", /\/admin\/reservas\//);
  await page.keyboard.press("Escape");
  await expect(detailDialog).toBeHidden();

  const emptyDay = page
    .locator('button[aria-label^="Crear reserva o bloqueo el"]:visible')
    .first();
  await emptyDay.click();
  const quickCreateDialog = page.getByRole("dialog");
  const newReservation = quickCreateDialog.getByRole("link", {
    name: "Nueva reserva",
  });
  await expect(newReservation).toBeVisible();
  await expect(
    quickCreateDialog.getByRole("link", { name: "Nuevo bloqueo" })
  ).toBeVisible();
  // No room filter is active, so quick-create from the classic grid does not preselect a room.
  await expect(newReservation).not.toHaveAttribute("href", /roomId=/);
});

test("renders as a vertical agenda with no horizontal scroll on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(octoberUrl);
  await expect(
    page.getByRole("heading", { name: "Calendario por habitación" })
  ).toBeVisible();
  expect(
    await page
      .locator("html")
      .evaluate((element) => element.scrollWidth <= element.clientWidth)
  ).toBe(true);
});
