import { expect, test } from "@playwright/test";

async function prepareAndConfirmAssistantProposal(
  page: import("@playwright/test").Page
) {
  await page
    .getByLabel("Instrucción")
    .fill("Bloquea la habitación para mantenimiento");
  await page.getByRole("button", { name: "Preparar propuesta" }).click();
  await expect(page.getByText("Vista previa: demo-room-valle")).toBeVisible();
  await expect(page.getByText("Mantenimiento programado")).toBeVisible();
  await page.getByRole("button", { name: "Confirmar propuesta" }).click();
}

// Módulo del asistente temporalmente cerrado (2026-09-07): /admin/asistente
// redirige a /admin, por lo que este flujo queda deshabilitado hasta reabrirlo.
test.skip("administrator confirms assistant preview, rejects conflict, and uses manual fallback", async ({
  page,
}) => {
  const providerRequests: string[] = [];
  page.on("request", (request) => {
    const hostname = new URL(request.url()).hostname;
    if (hostname !== "127.0.0.1" && hostname !== "localhost") {
      providerRequests.push(request.url());
    }
  });

  await page.goto("/admin/asistente");
  await expect(
    page.getByRole("heading", { name: "Asistente de calendario" })
  ).toBeVisible();

  await prepareAndConfirmAssistantProposal(page);
  await expect(
    page.getByText("Bloqueo creado y disponibilidad actualizada.")
  ).toBeVisible();

  await page.getByRole("link", { name: "Usar bloqueo manual" }).click();
  await expect(page).toHaveURL(/\/admin\/bloqueos$/);
  await expect(
    page.getByText("demo-room-valle: 2044-01-01 a 2044-01-03")
  ).toBeVisible();

  await page.goto("/admin/asistente");
  await prepareAndConfirmAssistantProposal(page);
  await expect(
    page.getByText(
      "No pudimos ejecutar la propuesta. La disponibilidad pudo haber cambiado; revisa el calendario o usa el formulario manual."
    )
  ).toBeVisible();

  await page.getByRole("link", { name: "Usar bloqueo manual" }).click();
  await expect(
    page.getByText("demo-room-valle: 2044-01-01 a 2044-01-03")
  ).toHaveCount(1);
  const manual = page.getByRole("form", { name: "Crear bloqueo" });
  await manual.getByLabel("Habitación").fill("demo-room-andes");
  await manual.getByLabel("Entrada").fill("2044-02-01");
  await manual.getByLabel("Salida").fill("2044-02-03");
  await manual.getByLabel("Motivo").fill("Mantenimiento manual E2E");
  await manual.getByRole("button", { name: "Crear bloqueo" }).click();
  await expect(page.getByRole("status")).toHaveText("Bloqueo creado.");
  await expect(
    page.getByText("demo-room-andes: 2044-02-01 a 2044-02-03")
  ).toBeVisible();

  expect(providerRequests).toEqual([]);
});
