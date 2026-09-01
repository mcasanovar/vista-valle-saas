import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CalendarAssistantChat } from "@/features/assistant/calendar-assistant-chat";

function createStartAction() {
  return vi.fn().mockResolvedValue({
    token: "proposal-token",
    roomId: "demo-room-valle",
    checkIn: "2044-01-01",
    checkOut: "2044-01-03",
    reason: "Mantenimiento programado",
  });
}

function createChatActions() {
  return {
    start: createStartAction(),
    confirm: vi.fn().mockResolvedValue(undefined),
    cancel: vi.fn().mockResolvedValue(undefined),
  };
}

function expectTokenOnly(action: ReturnType<typeof vi.fn>) {
  const data = action.mock.calls[0]?.[0] as FormData;
  expect([...data.entries()]).toEqual([["token", "proposal-token"]]);
}

describe("calendar assistant chat", () => {
  it("sends only the generated token when cancelling a preview", async () => {
    const user = userEvent.setup();
    const actions = createChatActions();
    render(<CalendarAssistantChat {...actions} />);
    await user.type(
      screen.getByLabelText("Instrucción"),
      "bloquear por mantenimiento"
    );
    await user.click(
      screen.getByRole("button", { name: "Preparar propuesta" })
    );
    expect(await screen.findByText(/Vista previa/)).toBeVisible();
    expect(screen.getByText(/demo-room-valle/)).toBeVisible();
    expect(screen.getByText(/Mantenimiento programado/)).toBeVisible();
    const startData = actions.start.mock.calls[0]?.[0] as FormData;
    expect([...startData.entries()]).toEqual([
      ["instruction", "bloquear por mantenimiento"],
    ]);
    await user.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(await screen.findByText("Propuesta cancelada.")).toBeVisible();
    expectTokenOnly(actions.cancel);
    expect(actions.confirm).not.toHaveBeenCalled();
  });

  it("clarifies, then executes with only the generated token and no network", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const actions = createChatActions();
    render(<CalendarAssistantChat {...actions} />);
    await user.type(screen.getByLabelText("Instrucción"), "aclarar");
    await user.click(
      screen.getByRole("button", { name: "Preparar propuesta" })
    );
    expect(
      await screen.findByText(
        "Indica habitación, fechas y motivo para continuar."
      )
    ).toBeVisible();
    await user.clear(screen.getByLabelText("Instrucción"));
    await user.type(screen.getByLabelText("Instrucción"), "mantenimiento");
    await user.click(
      screen.getByRole("button", { name: "Preparar propuesta" })
    );
    await screen.findByText(/Vista previa/);
    const correctedStart = actions.start.mock.calls[0]?.[0] as FormData;
    expect([...correctedStart.entries()]).toEqual([
      ["instruction", "mantenimiento"],
      ["correction", "aclarar"],
    ]);
    await user.click(
      await screen.findByRole("button", { name: "Confirmar propuesta" })
    );
    expect(
      await screen.findByText("Bloqueo creado y disponibilidad actualizada.")
    ).toBeVisible();
    expectTokenOnly(actions.confirm);
    expect(actions.cancel).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows safe failure and manual fallback", async () => {
    const user = userEvent.setup();
    render(<CalendarAssistantChat {...createChatActions()} />);
    await user.type(screen.getByLabelText("Instrucción"), "fallo");
    await user.click(
      screen.getByRole("button", { name: "Preparar propuesta" })
    );
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(
      screen.getByRole("link", { name: "Usar bloqueo manual" })
    ).toHaveAttribute("href", "/admin/bloqueos");
  });
});
