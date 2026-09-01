import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { ManualReservationForm } from "@/features/admin/manual-reservation-form";
import type { ManualReservationActionResult } from "@/features/admin/manual-reservation-action";
import { ToastProvider } from "@/presentation/organisms";

const initialData = {
  availability: { status: "dates_required" as const },
  rooms: [{ capacity: 2, id: "initial-room", name: "Inicial" }],
};

function availableResponse() {
  return new Response(
    JSON.stringify({
      rooms: [
        {
          capacity: 2,
          id: "available-room",
          name: "Habitación Valle",
          nightlyPriceClp: 60000,
        },
      ],
    }),
    { status: 200 }
  );
}

function renderForm(
  props: Readonly<{
    action: (data: FormData) => Promise<ManualReservationActionResult>;
  }>
) {
  return render(
    <ToastProvider>
      <ManualReservationForm action={props.action} initialData={initialData} />
    </ToastProvider>
  );
}

async function loadAvailability() {
  fireEvent.change(screen.getByLabelText("Entrada"), {
    target: { value: "2033-02-10" },
  });
  fireEvent.change(screen.getByLabelText("Salida"), {
    target: { value: "2033-02-12" },
  });
  await screen.findByRole("checkbox", { name: /habitación valle/i });
}

async function fillValidReservation(user: ReturnType<typeof userEvent.setup>) {
  await loadAvailability();
  await user.click(
    screen.getByRole("checkbox", { name: /habitación valle/i })
  );
  await user.type(screen.getByLabelText("Nombre"), "Ana");
  await user.type(screen.getByLabelText("Apellido"), "Pérez");
  await user.type(
    screen.getByLabelText("Correo electrónico"),
    "ana@example.test"
  );
  await user.type(screen.getByLabelText("Teléfono"), "+56912345678");
}

describe("manual reservation form", () => {
  it("renders all reservation, guest, invoice, and trusted availability controls", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => availableResponse())
    );
    const user = userEvent.setup();
    renderForm({ action: vi.fn() });

    expect(
      screen.getByText(/selecciona entrada y salida para consultar/i)
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: /habitación valle/i })
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Origen")).toBeInTheDocument();
    expect(screen.getByLabelText("Cantidad de huéspedes")).toHaveAttribute(
      "name",
      "guestCount"
    );
    expect(screen.getByLabelText("Comentario (opcional)")).toHaveAttribute(
      "name",
      "comment"
    );

    await loadAvailability();
    expect(
      screen.getByRole("checkbox", { name: /habitación valle/i })
    ).toHaveAttribute("name", "roomIds");
    await user.click(
      screen.getByRole("checkbox", { name: /solicitar factura/i })
    );
    expect(screen.getByLabelText("Razón social")).toHaveAttribute(
      "name",
      "invoiceName"
    );
    expect(screen.getByLabelText("RUT")).toHaveAttribute("name", "invoiceRut");
    expect(screen.getByLabelText("Correo de facturación")).toHaveAttribute(
      "name",
      "invoiceEmail"
    );
    vi.unstubAllGlobals();
  });

  it("replaces date-dependent room controls with a labelled skeleton while loading", async () => {
    let resolveFetch: ((response: Response) => void) | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn(
        () =>
          new Promise<Response>((resolve) => {
            resolveFetch = resolve;
          })
      )
    );
    renderForm({ action: vi.fn() });
    fireEvent.change(screen.getByLabelText("Entrada"), {
      target: { value: "2033-02-10" },
    });
    fireEvent.change(screen.getByLabelText("Salida"), {
      target: { value: "2033-02-12" },
    });

    expect(screen.getByTestId("room-skeleton")).toHaveAttribute(
      "aria-busy",
      "true"
    );
    expect(
      screen.getByRole("status", { name: /cargando habitaciones/i })
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("checkbox", { name: /habitación valle/i })
    ).not.toBeInTheDocument();
    resolveFetch?.(availableResponse());
    await screen.findByRole("checkbox", { name: /habitación valle/i });
    vi.unstubAllGlobals();
  });

  it("shows linked field errors and focuses the error summary", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => availableResponse())
    );
    renderForm({ action: vi.fn() });
    await loadAvailability();

    fireEvent.submit(
      screen.getByRole("form", { name: "Crear reserva manual" })
    );

    const heading = await screen.findByText("Revisa los datos de la reserva");
    const summary = heading.closest("div");
    expect(summary).toHaveFocus();
    expect(
      screen.getByText(/selecciona al menos una habitación/i, {
        selector: "p",
      })
    ).toHaveAttribute("role", "alert");
    expect(
      screen.getByText(/indica un correo electrónico/i, { selector: "p" })
    ).toHaveAttribute("role", "alert");
    vi.unstubAllGlobals();
  });

  it("keeps visible labelled pending feedback and disables submit", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => availableResponse())
    );
    let resolveAction: (() => void) | undefined;
    const action = vi.fn(
        () =>
        new Promise<ManualReservationActionResult>((resolve) => {
          resolveAction = () =>
            resolve({
              ok: true,
              origin: "admin",
              reservationId: "reservation-pending",
            });
        })
    );
    const user = userEvent.setup();
    renderForm({ action });
    await fillValidReservation(user);
    fireEvent.submit(
      screen.getByRole("form", { name: "Crear reserva manual" })
    );

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const pending = await screen.findByRole("button", {
      name: "Creando reserva…",
    });
    expect(pending).toBeDisabled();
    expect(pending).toHaveTextContent("Creando reserva…");
    resolveAction?.();
    const form = screen.getByRole("form", { name: "Crear reserva manual" });
    await waitFor(() =>
      expect(within(form).getByRole("status")).toHaveTextContent(
        "Reserva creada"
      )
    );
    expect(screen.getAllByText(/reserva creada/i)).toHaveLength(2);
    vi.unstubAllGlobals();
  });

  it("keeps entered values and exposes a server validation field error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => availableResponse()));
    const user = userEvent.setup();
    const action = vi.fn(async () =>
      ({
        code: "validation",
        fieldErrors: [
          { field: "email", message: "Ingresa un correo electrónico válido." },
        ],
        message: "Revisa los datos de la reserva antes de confirmarla.",
        ok: false,
      }) satisfies ManualReservationActionResult
    );
    renderForm({ action });
    await fillValidReservation(user);

    fireEvent.submit(
      screen.getByRole("form", { name: "Crear reserva manual" })
    );

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(await screen.findByText("Revisa los datos de la reserva")).toBeVisible();
    expect(screen.getByLabelText("Correo electrónico")).toHaveValue(
      "ana@example.test"
    );
    expect(
      screen.getByText("Ingresa un correo electrónico válido.", {
        selector: "p",
      })
    ).toHaveAttribute("role", "alert");
    expect(screen.queryByText(/^Reserva creada/)).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("keeps entered values and reports a committing availability conflict", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => availableResponse()));
    const user = userEvent.setup();
    const action = vi.fn(async () =>
      ({
        code: "availability_conflict",
        fieldErrors: [
          {
            field: "roomIds",
            message:
              "Una o más habitaciones ya no están disponibles para estas fechas.",
          },
        ],
        message:
          "La disponibilidad cambió antes de confirmar. Revisa las habitaciones y vuelve a intentarlo.",
        ok: false,
      }) satisfies ManualReservationActionResult
    );
    renderForm({ action });
    await fillValidReservation(user);

    fireEvent.submit(
      screen.getByRole("form", { name: "Crear reserva manual" })
    );

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const conflictMatches = await screen.findAllByText(
      /la disponibilidad cambió antes de confirmar/i
    );
    expect(conflictMatches.length).toBeGreaterThan(0);
    expect(conflictMatches[0]).toBeVisible();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Ana");
    expect(
      screen.getByRole("checkbox", { name: /habitación valle/i })
    ).toBeChecked();
    expect(screen.queryByText(/^Reserva creada/)).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("shows a subtotal and total preview once dates and rooms are selected", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => availableResponse())
    );
    const user = userEvent.setup();
    renderForm({ action: vi.fn() });
    await loadAvailability();
    await user.click(
      screen.getByRole("checkbox", { name: /habitación valle/i })
    );

    expect(screen.getByText(/resumen de tarifa/i)).toBeInTheDocument();
    expect(screen.getAllByText("$120.000")).toHaveLength(2);
    vi.unstubAllGlobals();
  });

  it("rejects a check-in date before today, matching the public search rule", async () => {
    renderForm({ action: vi.fn() });
    fireEvent.submit(
      screen.getByRole("form", { name: "Crear reserva manual" })
    );

    fireEvent.change(screen.getByLabelText("Entrada"), {
      target: { value: "2000-01-01" },
    });
    fireEvent.change(screen.getByLabelText("Salida"), {
      target: { value: "2000-01-02" },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "Crear reserva manual" })
    );

    const dateErrors = await screen.findAllByText(
      "La fecha de entrada no puede ser anterior a hoy."
    );
    expect(dateErrors.length).toBeGreaterThan(0);
  });
});
