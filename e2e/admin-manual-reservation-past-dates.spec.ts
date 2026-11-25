import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * `admin-manual-reservations` spec, "Registro de estadías ya iniciadas o
 * pasadas": the administrative creation flow accepts a check-in before today,
 * so a stay that arrived late can be registered with its real dates. The
 * public search keeps its own current-date rule, exercised by the last test.
 *
 * What each assertion would have caught before the change: the entry control
 * carried today as its `min`, so the browser's own date picker made a past
 * check-in unreachable; and the authenticated availability BFF rejected the
 * dates outright, so the form showed its "no pudimos consultar" error instead
 * of a list of rooms.
 *
 * These tests run under the mock context (`.env.test.example`), where the
 * availability repository is deliberately empty and `/admin/reservas` renders
 * nothing - that listing reads production data only. So the proof that a
 * reservation was really created is the action's own success status, which it
 * returns only after the reservation is persisted.
 */

const LODGING_TIME_ZONE = "America/Santiago";

/** Today in the lodging time zone, independent of the runner's clock. */
function lodgingToday() {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: LODGING_TIME_ZONE,
    year: "numeric",
  }).format(new Date());
}

function shiftDays(date: string, amount: number) {
  const shifted = new Date(`${date}T12:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + amount);
  return shifted.toISOString().slice(0, 10);
}

const today = lodgingToday();
const yesterday = shiftDays(today, -1);
const tomorrow = shiftDays(today, 1);

const AVAILABILITY_QUERY_ERROR =
  "No pudimos consultar las habitaciones. Revisa las fechas e inténtalo nuevamente.";

async function openManualReservationForm(page: Page) {
  await page.goto("/admin/reservas/nueva");
  const form = page.getByRole("form", { name: "Crear reserva manual" });
  await expect(form).toBeVisible();
  // Wait for the client form to hydrate before filling controlled dates.
  await page.waitForTimeout(500);
  return form;
}

async function fillDates(form: Locator, checkIn: string, checkOut: string) {
  const checkInField = form.getByLabel("Entrada");
  const checkOutField = form.getByLabel("Salida");
  await checkInField.fill(checkIn);
  await expect(checkInField).toHaveValue(checkIn);
  await checkOutField.fill(checkOut);
  await expect(checkOutField).toHaveValue(checkOut);
}

async function fillGuestAndSubmit(form: Locator, email: string) {
  await form.getByLabel("Nombre").fill("Llegada");
  await form.getByLabel("Apellido").fill("Tardía");
  await form.getByLabel("Correo").fill(email);
  await form.getByRole("textbox", { name: "Teléfono" }).fill("123");
  await form
    .getByRole("spinbutton", { name: "Cantidad de huéspedes" })
    .fill("1");
  await form.getByRole("button", { name: "Crear reserva" }).click();
}

test("the entry control no longer bars past dates and departure follows the chosen entry", async ({
  page,
}) => {
  const form = await openManualReservationForm(page);

  await expect(form.getByLabel("Entrada")).not.toHaveAttribute("min");

  await fillDates(form, yesterday, tomorrow);
  await expect(form.getByLabel("Salida")).toHaveAttribute("min", yesterday);
});

test("resolves availability for a stay already under way and registers it", async ({
  page,
}) => {
  const form = await openManualReservationForm(page);
  await fillDates(form, yesterday, tomorrow);

  // The BFF accepted a past interval: rooms came back instead of an error.
  const room = form.getByRole("checkbox", { name: /individual/i });
  await expect(room).toBeVisible();
  await expect(form.getByText(AVAILABILITY_QUERY_ERROR)).toHaveCount(0);
  await room.check();

  await form.getByLabel("Origen").selectOption("whatsapp");
  await fillGuestAndSubmit(form, "past-stay-e2e@example.test");

  await expect(form.getByRole("status")).toContainText("Reserva creada.");
  await expect(form.getByRole("alert")).toHaveCount(0);
});

test("resolves availability for a stay that already ended and registers it", async ({
  page,
}) => {
  const form = await openManualReservationForm(page);
  await fillDates(form, "2019-05-10", "2019-05-14");

  const room = form.getByRole("checkbox", { name: /individual/i });
  await expect(room).toBeVisible();
  await expect(form.getByText(AVAILABILITY_QUERY_ERROR)).toHaveCount(0);
  await room.check();

  await form.getByLabel("Origen").selectOption("airbnb");
  await fillGuestAndSubmit(form, "past-import-e2e@example.test");

  await expect(form.getByRole("status")).toContainText("Reserva creada.");
  await expect(form.getByRole("alert")).toHaveCount(0);
});

test("names the date rule when the departure does not follow the entry", async ({
  page,
}) => {
  const form = await openManualReservationForm(page);
  await fillDates(form, "2019-06-14", "2019-06-10");

  // The administrator reads the rule that was broken, not the generic
  // availability-query failure a doomed request would have produced.
  await expect(
    form.getByRole("alert").filter({
      hasText: "La fecha de salida debe ser posterior a la de entrada.",
    })
  ).toBeVisible();
  await expect(form.getByText(AVAILABILITY_QUERY_ERROR)).toHaveCount(0);
  await expect(
    form.getByRole("button", { name: "Crear reserva" })
  ).toBeDisabled();
});

test("the public availability search keeps its current-date rule", async ({
  page,
}) => {
  await page.goto(
    `/disponibilidad?checkIn=${yesterday}&checkOut=${tomorrow}&guests=2`
  );

  await expect(
    page.getByText("La fecha de entrada no puede ser anterior a hoy.")
  ).toBeVisible();
});
