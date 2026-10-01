import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { EditReservationStayForm } from "@/features/admin/edit-reservation-stay-form";
import type { EditReservationStayActionResult } from "@/features/admin/edit-reservation-stay-action";
import { ToastProvider } from "@/presentation/organisms";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const availableRooms = [
  { capacity: 4, id: "room-a", name: "Cabaña Alerce" },
  { capacity: 3, id: "room-b", name: "Cabaña Mañío" },
  { capacity: 6, id: "room-c", name: "Cabaña Coigüe" },
];

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(
      async () =>
        new Response(JSON.stringify({ rooms: availableRooms }), {
          headers: { "content-type": "application/json" },
          status: 200,
        })
    )
  );
});

afterEach(() => vi.unstubAllGlobals());

function renderForm(
  overrides: Partial<
    Readonly<{
      action: (data: FormData) => Promise<EditReservationStayActionResult>;
      channelConnectedRoomIds: readonly string[];
      checkIn: string;
      checkOut: string;
      currentRooms: readonly Readonly<{
        guestCount: number;
        roomId: string;
      }>[];
      externalChannelLabel: string;
      reservationId: string;
    }>
  > = {}
) {
  const action = overrides.action ?? vi.fn(async () => ({ ok: true as const }));
  render(
    <ToastProvider>
      <EditReservationStayForm
        action={action}
        checkIn="2035-01-01"
        checkOut="2035-01-03"
        currentRooms={[{ guestCount: 2, roomId: "room-a" }]}
        reservationId="reservation-1"
        {...overrides}
      />
    </ToastProvider>
  );
  return action;
}

async function waitForRooms() {
  await waitFor(() =>
    expect(
      screen.getByRole("checkbox", { name: /Cabaña Alerce/ })
    ).toBeVisible()
  );
}

describe("stay form sends all three axes in one submit (task 6.1)", () => {
  it("preselects the reservation's current rooms with their occupancy", async () => {
    renderForm();
    await waitForRooms();

    expect(
      screen.getByRole("checkbox", { name: /Cabaña Alerce/ })
    ).toBeChecked();
    expect(
      screen.getByRole("checkbox", { name: /Cabaña Mañío/ })
    ).not.toBeChecked();
    expect(screen.getByLabelText("Huéspedes en Cabaña Alerce")).toHaveValue(2);
  });

  it("submits dates, rooms and occupancy together", async () => {
    const action = renderForm();
    await waitForRooms();

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Cabaña Coigüe/ })
    );
    fireEvent.change(screen.getByLabelText("Huéspedes en Cabaña Coigüe"), {
      target: { value: "5" },
    });

    fireEvent.submit(
      screen.getByRole("form", { name: "Editar estadía de la reserva" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cambio de estadía" })
    );

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const data = (action as ReturnType<typeof vi.fn>).mock
      .calls[0]![0] as FormData;
    expect(data.get("id")).toBe("reservation-1");
    expect(data.get("checkIn")).toBe("2035-01-01");
    expect(data.get("checkOut")).toBe("2035-01-03");
    expect(data.get("rooms")).toBe("room-a:2,room-c:5");
  });

  it("does not call the action until the confirmation is accepted", async () => {
    const action = renderForm();
    await waitForRooms();

    fireEvent.submit(
      screen.getByRole("form", { name: "Editar estadía de la reserva" })
    );
    expect(action).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Confirmar edición de estadía" })
    ).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(action).not.toHaveBeenCalled();
  });

  it("names the rooms that will be added and removed before confirming", async () => {
    renderForm();
    await waitForRooms();

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Cabaña Alerce/ })
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: /Cabaña Mañío/ })
    );

    fireEvent.submit(
      screen.getByRole("form", { name: "Editar estadía de la reserva" })
    );

    const dialog = screen.getByRole("dialog", {
      name: "Confirmar edición de estadía",
    });
    expect(dialog).toHaveTextContent("Se quitarán: Cabaña Alerce.");
    expect(dialog).toHaveTextContent("Se agregarán: Cabaña Mañío.");
  });

  it("clamps the occupancy to the room's capacity", async () => {
    renderForm();
    await waitForRooms();

    fireEvent.change(screen.getByLabelText("Huéspedes en Cabaña Alerce"), {
      target: { value: "99" },
    });
    expect(screen.getByLabelText("Huéspedes en Cabaña Alerce")).toHaveValue(4);
  });

  it("asks the availability boundary for this reservation's own interval", async () => {
    renderForm();
    await waitForRooms();

    const url = String(
      (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0]
    );
    expect(url).toContain("/api/admin/reservations/stay-availability");
    expect(url).toContain("reservationId=reservation-1");
    expect(url).toContain("checkIn=2035-01-01");
  });
});

describe("financial outcome of the edit (task 6.3)", () => {
  it("reports the recalculated total, the pending balance and the overpayment", async () => {
    const action = vi.fn(async () => ({
      financialSummary: {
        overpaymentClp: 40_000,
        pendingBalanceClp: 0,
        totalClp: 110_000,
      },
      ok: true as const,
    }));
    renderForm({ action });
    await waitForRooms();

    fireEvent.submit(
      screen.getByRole("form", { name: "Editar estadía de la reserva" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cambio de estadía" })
    );

    const summary = await screen.findByRole("group", {
      name: "Resultado financiero de la estadía",
    });
    expect(summary).toHaveTextContent("Total recalculado");
    expect(summary).toHaveTextContent("Saldo pendiente");
    expect(summary).toHaveTextContent("Sobrepago por resolver");
  });

  it("omits the overpayment row when there is none", async () => {
    const action = vi.fn(async () => ({
      financialSummary: {
        overpaymentClp: 0,
        pendingBalanceClp: 25_000,
        totalClp: 150_000,
      },
      ok: true as const,
    }));
    renderForm({ action });
    await waitForRooms();

    fireEvent.submit(
      screen.getByRole("form", { name: "Editar estadía de la reserva" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cambio de estadía" })
    );

    const summary = await screen.findByRole("group", {
      name: "Resultado financiero de la estadía",
    });
    expect(summary).not.toHaveTextContent("Sobrepago por resolver");
  });
});

describe("a stay cannot be left with no rooms (task 6.4)", () => {
  it("does not submit and explains why when every room is deselected", async () => {
    const action = renderForm();
    await waitForRooms();

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Cabaña Alerce/ })
    );

    fireEvent.submit(
      screen.getByRole("form", { name: "Editar estadía de la reserva" })
    );

    expect(action).not.toHaveBeenCalled();
    expect(
      screen.queryByRole("dialog", { name: "Confirmar edición de estadía" })
    ).toBeNull();
    expect(
      await screen.findAllByText(
        "La reserva debe conservar al menos una habitación."
      )
    ).not.toHaveLength(0);
  });

  it("surfaces the server's rejection when it arrives anyway", async () => {
    const action = vi.fn(async () => ({
      code: "validation" as const,
      message: "La reserva debe conservar al menos una habitación.",
      ok: false as const,
    }));
    renderForm({ action });
    await waitForRooms();

    fireEvent.submit(
      screen.getByRole("form", { name: "Editar estadía de la reserva" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar cambio de estadía" })
    );

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    expect(
      await screen.findAllByText(
        "La reserva debe conservar al menos una habitación."
      )
    ).not.toHaveLength(0);
  });
});

describe("channel sync warning for room changes (task 7)", () => {
  it("warns that a room change does not reach the external platform", async () => {
    renderForm({ externalChannelLabel: "Airbnb" });
    await waitForRooms();

    expect(screen.queryByText(/no se refleja en Airbnb/)).toBeNull();

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Cabaña Mañío/ })
    );

    expect(await screen.findByText(/no se refleja en Airbnb/)).toBeVisible();
  });

  it("names an incoming room that has no active channel connection", async () => {
    renderForm({ channelConnectedRoomIds: ["room-a", "room-b"] });
    await waitForRooms();

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Cabaña Coigüe/ })
    );

    expect(
      await screen.findByText(
        /Cabaña Coigüe no tiene una conexión de canal activa/
      )
    ).toBeVisible();
  });

  it("names none when the swap stays between connected rooms", async () => {
    renderForm({ channelConnectedRoomIds: ["room-a", "room-b"] });
    await waitForRooms();

    await userEvent.click(
      screen.getByRole("checkbox", { name: /Cabaña Alerce/ })
    );
    await userEvent.click(
      screen.getByRole("checkbox", { name: /Cabaña Mañío/ })
    );

    expect(
      screen.queryByText(/no tiene una conexión de canal activa/)
    ).toBeNull();
    expect(
      screen.queryByText(/no tienen una conexión de canal activa/)
    ).toBeNull();
  });
});
