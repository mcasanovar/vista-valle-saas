import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { EditReservationDatesForm } from "@/features/admin/edit-reservation-dates-form";
import type { EditReservationDatesActionResult } from "@/features/admin/edit-reservation-dates-action";
import { ToastProvider } from "@/presentation/organisms";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

function renderForm(
  props: Readonly<{
    action: (data: FormData) => Promise<EditReservationDatesActionResult>;
    checkIn: string;
    checkOut: string;
    reservationId: string;
  }>
) {
  return render(
    <ToastProvider>
      <EditReservationDatesForm {...props} />
    </ToastProvider>
  );
}

describe("edit reservation dates form", () => {
  it("does not call the action until the confirmation dialog is accepted", async () => {
    const action = vi.fn();
    renderForm({
        action,
        checkIn: "2035-01-01",
        checkOut: "2035-01-03",
        reservationId: "reservation-1",
    });

    fireEvent.submit(
      screen.getByRole("form", { name: "Editar fechas de la reserva" })
    );
    expect(action).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Confirmar edición de fechas" })
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(action).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Confirmar edición de fechas" })
    ).not.toBeInTheDocument();
  });

  it("submits the new dates only after explicit confirmation and shows success", async () => {
    const action = vi.fn().mockResolvedValue({ ok: true });
    renderForm({
        action,
        checkIn: "2035-01-01",
        checkOut: "2035-01-03",
        reservationId: "reservation-1",
    });

    fireEvent.change(screen.getByLabelText("Nueva salida"), {
      target: { value: "2035-01-05" },
    });
    fireEvent.submit(
      screen.getByRole("form", { name: "Editar fechas de la reserva" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cambio de fechas" })
    );

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(action.mock.calls[0]![0].get("checkOut")).toBe("2035-01-05");
    expect(action.mock.calls[0]![0].get("id")).toBe("reservation-1");
    const form = screen.getByRole("form", {
      name: "Editar fechas de la reserva",
    });
    await waitFor(() =>
      expect(within(form).getByRole("status")).toHaveTextContent(
        "Fechas actualizadas."
      )
    );
  });

  it("shows the server's conflict message and never treats it as success", async () => {
    const action = vi.fn().mockResolvedValue({
      code: "conflict",
      message: "Las nuevas fechas ya no están disponibles para una de las habitaciones.",
      ok: false,
    });
    renderForm({
        action,
        checkIn: "2035-01-01",
        checkOut: "2035-01-03",
        reservationId: "reservation-1",
    });

    fireEvent.submit(
      screen.getByRole("form", { name: "Editar fechas de la reserva" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cambio de fechas" })
    );

    const form = screen.getByRole("form", {
      name: "Editar fechas de la reserva",
    });
    await waitFor(() =>
      expect(within(form).getByRole("status")).toHaveTextContent(
        "Las nuevas fechas ya no están disponibles"
      )
    );
  });

  it("supports keyboard-only confirmation and cancellation", async () => {
    const user = userEvent.setup();
    const action = vi.fn().mockResolvedValue({ ok: true });
    renderForm({
        action,
        checkIn: "2035-01-01",
        checkOut: "2035-01-03",
        reservationId: "reservation-1",
    });

    const submit = screen.getByRole("button", { name: "Editar fechas" });
    submit.focus();
    await user.keyboard("{Enter}");
    expect(
      screen.getByRole("dialog", { name: "Confirmar edición de fechas" })
    ).toBeVisible();

    await user.tab();
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(action).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Confirmar edición de fechas" })
    ).not.toBeInTheDocument();

    submit.focus();
    await user.keyboard("{Enter}");
    await user.tab();
    await user.tab();
    expect(
      screen.getByRole("button", { name: "Confirmar cambio de fechas" })
    ).toHaveFocus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
  });
});
