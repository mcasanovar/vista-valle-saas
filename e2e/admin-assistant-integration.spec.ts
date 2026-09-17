import { expect, test } from "@playwright/test";

/**
 * These three flows (tasks 12.1-12.3) exercise real natural-language
 * understanding, so they run only against a real `AssistantModel` — the
 * deterministic mock (used by the rest of the suite, including
 * `admin-assistant.spec.ts`) only ever returns one canned line and can't
 * drive a real conversation. Run this file with `AI_PROVIDER=openai` and a
 * real `AI_API_KEY` set (still against the mock *data* context, so nothing
 * here touches production); it costs real API usage, which is why it's
 * kept out of the default `npm run test:e2e` run.
 */
test.skip(
  process.env.ASSISTANT_ENABLED !== "true" || process.env.AI_PROVIDER !== "openai",
  "requires ASSISTANT_ENABLED=true and AI_PROVIDER=openai"
);

/**
 * Verified live against `gpt-5-mini` on 2026-09-17: this run caught and
 * led to fixing two real bugs (the mock proposal store not surviving
 * Next.js dev's multiple module instances, and the console unmounting a
 * proposal card on any resolution instead of only a successful one) that
 * no unit test had reached, because both only show up when a real model
 * drives the full browser flow. Task 12.3 below is written but can't
 * currently run even with this flag on: `/admin/reservas` and the
 * `cambiar_estado`/`registrar_cobro` write tools require a real
 * production database (a pre-existing constraint, not introduced by this
 * change) — the mock context this file otherwise runs against has no
 * reservations list/detail to drive it. Running it needs `AI_PROVIDER`
 * set here *and* `VISTA_VALLE_CONFIG_CONTEXT=production` against a
 * disposable test database, mirroring `postgres-*.integration.test.ts`.
 * Its guarantee (cancelling never touches payment; the proposal shows the
 * payment's amount and status) is covered today by
 * `tests/assistant-execute-operation.test.ts` and
 * `tests/assistant-write-tools.test.ts`.
 */

test.describe.configure({ mode: "serial" });

test("full read flow: natural-language instruction resolves to real availability data (task 12.1)", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await page.goto("/admin/asistente");

  await page
    .getByLabel("Instrucción para el asistente")
    .fill("¿Qué habitaciones tienen disponibilidad del 10 al 12 de octubre de 2056?");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(
    page.getByText(/Habitación (Individual|Matrimonial|Doble)/)
  ).toBeVisible({ timeout: 30_000 });
});

test("full write flow: instruction, proposal, confirmation, execution and audit (task 12.2)", async ({
  page,
}) => {
  await page.goto("/admin/login");
  await page.goto("/admin/asistente");

  await page
    .getByLabel("Instrucción para el asistente")
    .fill(
      "Bloquea la Habitación Doble del 20 al 22 de octubre de 2056 por mantenimiento programado."
    );
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(page.getByText("Propuesta pendiente")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Bloquear habitación")).toBeVisible();

  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Propuesta confirmada")).toBeVisible({
    timeout: 15_000,
  });

  // The audited execution actually created the block, independent of the chat UI.
  await page.goto("/admin/bloqueos");
  await expect(
    page.getByText("2056-10-20 a 2056-10-22", { exact: false })
  ).toBeVisible();
});

test("cancelling a reservation with an approved payment leaves the payment untouched and the proposal showed the amount (task 12.3)", async ({
  page,
}) => {
  test.skip(
    process.env.VISTA_VALLE_CONFIG_CONTEXT !== "production",
    "requires a real database — /admin/reservas and cambiar_estado/registrar_cobro don't work against mock data"
  );
  await page.goto("/admin/login");
  await page.goto("/admin");

  // Deterministic setup (no LLM call): create a reservation and collect its
  // payment through the existing admin screens, exactly like
  // admin-operations.spec.ts already does.
  await page.getByRole("link", { name: "Nueva reserva" }).click();
  const manualReservation = page.getByRole("form", { name: "Crear reserva manual" });
  await manualReservation.getByLabel("Origen").selectOption("phone");
  await manualReservation.getByLabel("Entrada").fill("2056-09-10");
  await manualReservation.getByLabel("Salida").fill("2056-09-12");
  await manualReservation.getByRole("checkbox", { name: /individual/i }).check();
  await manualReservation.getByLabel("Nombre").fill("Asistente");
  await manualReservation.getByLabel("Apellido").fill("Cancelacion12-3");
  await manualReservation.getByLabel("Correo").fill("asistente-12-3@example.test");
  await manualReservation.getByRole("textbox", { name: "Teléfono" }).fill("123");
  await manualReservation.getByLabel("Cantidad de huéspedes").fill("1");
  await manualReservation.getByRole("button", { name: "Crear reserva" }).click();
  await expect(manualReservation.getByRole("status")).toContainText("Reserva creada.");

  await page.goto("/admin/reservas");
  const reservationRow = page
    .locator("tbody tr")
    .filter({ hasText: "2056-09-10" })
    .filter({ hasText: "2056-09-12" });
  await expect(reservationRow).toHaveCount(1);
  await reservationRow.getByRole("link", { name: /Ver reserva/ }).click();

  const collection = page.getByRole("form", { name: "Registrar cobro presencial" });
  const totalClp = await collection.getByLabel("Monto").inputValue();
  await collection.getByLabel("Fecha").fill("2056-09-10");
  await collection.getByLabel("Medio").fill("cash");
  await collection.getByRole("button", { name: "Registrar cobro" }).click();
  await expect(collection.getByRole("status")).toHaveText("Cobro registrado.");

  // Real assistant turn: ask it, in natural language, to cancel that reservation.
  await page.goto("/admin/asistente");
  await page
    .getByLabel("Instrucción para el asistente")
    .fill("Cancela la reserva de Asistente Cancelacion12-3.");
  await page.getByRole("button", { name: "Enviar" }).click();

  await expect(page.getByText("Propuesta pendiente")).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Cambiar estado de reserva")).toBeVisible();
  // The proposal shows the payment's current state as information, before confirming.
  await expect(page.getByText("approved")).toBeVisible();
  await expect(page.getByText(totalClp, { exact: false })).toBeVisible();

  await page.getByRole("button", { name: "Confirmar" }).click();
  await expect(page.getByText("Propuesta confirmada")).toBeVisible({
    timeout: 15_000,
  });

  // The reservation is cancelled, but its approved payment was never touched.
  await page.goto("/admin/reservas");
  await expect(reservationRow).toContainText("cancelled");
  await reservationRow.getByRole("link", { name: /Ver reserva/ }).click();
  await expect(page.getByText("approved")).toBeVisible();
});
