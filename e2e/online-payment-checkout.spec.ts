import { expect, test } from "@playwright/test";

// Serial: these tests hit `/reservar/procesando` and `/pre-reserva` for
// the first time in this file; `next dev` compiles a route on-demand on
// its first hit, and concurrent workers racing that cold compile is
// flaky. Serializing avoids that without weakening any assertion.
test.describe.configure({ mode: "serial" });

/**
 * Exercises the card-payment checkout entry point (Mercado Pago) for one
 * and for two rooms under a single payment for the total (see
 * `add-mercado-pago-checkout-pro` design.md decision 1), and the bank
 * transfer entry point (Fintoc) for one room. The checkout API's real
 * mock redirect URL points at a real external domain
 * (`mercadopago.cl`/`fintoc.com`), so the network response is intercepted
 * and rewritten to a same-origin URL before it reaches the browser — this
 * verifies the button correctly triggers the checkout call and follows
 * whatever redirect it returns, without the test ever leaving localhost.
 */

async function interceptCheckoutRedirect(page: import("@playwright/test").Page, path: string) {
  await page.route(`**${path}`, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    await route.fulfill({
      status: response.status(),
      contentType: "application/json",
      body: JSON.stringify({
        ...body,
        redirectUrl: body.redirectUrl
          ? "/reservar/procesando?payment=e2e-fake-payment-id"
          : undefined,
      }),
    });
  });
}

test("pays with a card for a single room and follows the checkout redirect", async ({
  page,
}) => {
  await interceptCheckoutRedirect(page, "/api/bookings/mercadopago-checkout");
  await page.goto(
    "/disponibilidad?checkIn=2062-03-10&checkOut=2062-03-13&guests=1"
  );
  await page.getByRole("button", { name: "Agregar a la reserva" }).first().click();
  await page.getByRole("link", { name: /Ver carrito/ }).click();
  await expect(page).toHaveURL(/\/pre-reserva\?/);

  await page.getByLabel("Nombre (requerido)").fill("Ana");
  await page.getByLabel("Apellido (requerido)").fill("Pérez");
  await page.getByLabel("Correo electrónico (requerido)").fill("ana@example.test");
  await page.getByLabel("Teléfono (requerido)").fill("+56 9 1111 1111");

  await page
    .getByRole("radio", { name: /Tarjeta de crédito o débito/ })
    .check();
  await page.getByRole("button", { name: "Confirmar reserva" }).click();

  await expect(page).toHaveURL(
    /\/reservar\/procesando\?payment=e2e-fake-payment-id/,
    { timeout: 15000 }
  );
});

test("pays with a card for two rooms under a single payment for the total", async ({
  page,
}) => {
  await interceptCheckoutRedirect(page, "/api/bookings/mercadopago-checkout");
  // Goes straight to the review page with two rooms already selected
  // (`rooms=<slug>:<guestCount>,...`, see `room-selection-codec.ts`) —
  // adding a second, specific, available room via the disponibilidad UI
  // is exercised by `e2e/prebooking-cart.spec.ts` already; this test is
  // only about the checkout step that follows.
  await page.goto(
    "/pre-reserva?checkIn=2063-03-10&checkOut=2063-03-13&guests=1&rooms=habitacion-valle-demo%3A1%2Chabitacion-terra-demo%3A1"
  );
  await expect(page).toHaveURL(/\/pre-reserva\?/);

  await page.getByLabel("Nombre (requerido)").fill("Ana");
  await page.getByLabel("Apellido (requerido)").fill("Pérez");
  await page.getByLabel("Correo electrónico (requerido)").fill("ana@example.test");
  await page.getByLabel("Teléfono (requerido)").fill("+56 9 1111 1111");

  await page
    .getByRole("radio", { name: /Tarjeta de crédito o débito/ })
    .check();
  await page.getByRole("button", { name: "Confirmar reserva" }).click();

  await expect(page).toHaveURL(
    /\/reservar\/procesando\?payment=e2e-fake-payment-id/,
    { timeout: 15000 }
  );
});

test("pays by bank transfer (Fintoc) for a single room", async ({ page }) => {
  await interceptCheckoutRedirect(page, "/api/bookings/fintoc-checkout");
  await page.goto(
    "/disponibilidad?checkIn=2064-03-10&checkOut=2064-03-13&guests=1"
  );
  await page.getByRole("button", { name: "Agregar a la reserva" }).first().click();
  await page.getByRole("link", { name: /Ver carrito/ }).click();
  await expect(page).toHaveURL(/\/pre-reserva\?/);

  await page.getByLabel("Nombre (requerido)").fill("Ana");
  await page.getByLabel("Apellido (requerido)").fill("Pérez");
  await page.getByLabel("Correo electrónico (requerido)").fill("ana@example.test");
  await page.getByLabel("Teléfono (requerido)").fill("+56 9 1111 1111");

  await page.getByRole("radio", { name: /Transferencia bancaria/ }).check();
  await page.getByRole("button", { name: "Confirmar reserva" }).click();

  await expect(page).toHaveURL(
    /\/reservar\/procesando\?payment=e2e-fake-payment-id/,
    { timeout: 15000 }
  );
});
