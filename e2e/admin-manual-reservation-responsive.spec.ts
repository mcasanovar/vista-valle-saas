import { expect, test, type Page } from "@playwright/test";

const viewports = [
  { height: 844, name: "mobile", width: 390 },
  { height: 1194, name: "tablet", width: 834 },
  { height: 1000, name: "desktop", width: 1440 },
] as const;

test.describe.configure({ mode: "serial" });

async function loadAvailableRooms(page: Page) {
  const form = page.getByRole("form", { name: "Crear reserva manual" });
  const checkIn = form.getByLabel("Entrada");
  const checkOut = form.getByLabel("Salida");
  await checkIn.fill("2056-06-10");
  await expect(checkIn).toHaveValue("2056-06-10");
  await checkOut.fill("2056-06-12");
  await expect(checkOut).toHaveValue("2056-06-12");
  await expect(
    form.getByRole("checkbox", { name: /Habitación/ }).first()
  ).toBeVisible();
  return form;
}

for (const viewport of viewports) {
  test(`manual reservation form remains operable at ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/admin/reservas/nueva");
    // Wait for the client form to hydrate before filling controlled dates.
    await page.waitForTimeout(500);

    const form = await loadAvailableRooms(page);
    const room = form.getByRole("checkbox", { name: /Habitación/ }).first();
    const roomLabel = room.locator("xpath=..");

    await expect(roomLabel).toHaveCSS("min-height", "56px");
    await room.check();
    await expect(form.getByText("Habitaciones seleccionadas: 1")).toBeVisible();
    await expect(form.getByText(/Habitaciones seleccionadas: 1/)).toContainText(
      "Habitaciones seleccionadas: 1"
    );
    expect(
      await page
        .locator("html")
        .evaluate((element) => element.scrollWidth <= element.clientWidth)
    ).toBe(true);

    // Native validation is intentionally retained. Disable it only in this
    // browser test to exercise the client-side accessible error summary.
    await form.evaluate((element) => {
      (element as HTMLFormElement).noValidate = true;
    });
    await form.getByRole("button", { name: "Crear reserva" }).click();
    const summary = form.getByRole("alert", {
      name: "Revisa los datos de la reserva",
    });
    await expect(summary).toBeVisible();
    await expect(summary).toBeFocused();

    const submit = form.getByRole("button", { name: "Crear reserva" });
    await submit.focus();
    const submitBounds = await submit.boundingBox();
    expect(submitBounds).not.toBeNull();
    expect((submitBounds?.height ?? 0) >= 44).toBeTruthy();
    expect(
      await submit.evaluate((element) => {
        const bounds = element.getBoundingClientRect();
        const elementAtCenter = document.elementFromPoint(
          bounds.left + bounds.width / 2,
          bounds.top + bounds.height / 2
        );
        return elementAtCenter === element || element.contains(elementAtCenter);
      })
    ).toBe(true);
  });
}
