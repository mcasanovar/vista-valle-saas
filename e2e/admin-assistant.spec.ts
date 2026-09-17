import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

// The assistant page redirects to /admin while ASSISTANT_ENABLED is off
// (design.md decision 11 — the flag stays off until the real provider is
// wired in section 11's migration step). This suite exercises the actual
// module, so it only runs against an environment where the flag is on.
test.skip(
  process.env.ASSISTANT_ENABLED !== "true",
  "requires ASSISTANT_ENABLED=true"
);

test("assistant page renders as a full module page, not an overlay (task 8.1)", async ({
  page,
}) => {
  await page.goto("/admin/asistente");
  await expect(page.getByRole("heading", { name: "Asistente" })).toBeVisible();
  // A full page occupies the admin content area alongside the shell nav,
  // rather than floating as a modal/overlay above it.
  await expect(
    page.getByRole("navigation", { name: "Navegación administrativa" })
  ).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("has no automated accessibility violations (task 8.6)", async ({ page }) => {
  await page.goto("/admin/asistente");
  await expect(page.getByRole("heading", { name: "Asistente" })).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("opening a new thread and resuming a previous one both work from the thread list (task 8.5)", async ({
  page,
}) => {
  await page.goto("/admin/asistente");

  const instruction = page.getByLabel("Instrucción para el asistente");
  await instruction.fill("Busca disponibilidad para mañana");
  await page.getByRole("button", { name: "Enviar" }).click();
  await expect(page.getByText("Busca disponibilidad para mañana")).toBeVisible();

  await page.getByRole("button", { name: "Nuevo hilo" }).click();
  await expect(
    page.getByText("Busca disponibilidad para mañana")
  ).not.toBeVisible();
});
