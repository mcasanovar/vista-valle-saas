import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ManualBlockForm } from "@/features/room-blocks/manual-block-form";
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const blocks = [
  {
    id: "block-1",
    roomId: "room-1",
    checkIn: "2035-01-01",
    checkOut: "2035-01-03",
    nights: 2,
    reason: "Mantención",
    createdBy: "admin-1",
    createdAt: new Date("2035-01-01T12:00:00.000Z"),
  },
];
const rooms = [
  { id: "room-1", name: "Valle" },
  { id: "room-2", name: "Terra" },
];
describe("manual block form", () => {
  it("renders quick prefill, multi-selection, filters, summary and audited detail", () => {
    render(
      <ManualBlockForm
        blocks={blocks}
        rooms={rooms}
        create={vi.fn()}
        remove={vi.fn()}
        filters={{ status: "active" }}
        page={2}
        total={1}
        initialSelection={{
          roomId: "room-1",
          checkIn: "2035-01-01",
          checkOut: "2035-01-03",
        }}
      />
    );
    expect(
      screen.getByRole("form", { name: "Filtrar bloqueos" })
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Valle")).toBeChecked();
    expect(screen.getByDisplayValue("2035-01-01")).toBeInTheDocument();
    expect(screen.getByText("2 noches")).toBeInTheDocument();
    expect(screen.getByText(/creado por admin-1/)).toBeInTheDocument();
    expect(screen.getByText(/creado 2035-01-01/)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Limpiar filtros" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Página anterior" })
    ).toHaveAttribute("href", expect.stringContaining("status=active"));
    expect(
      screen.queryByRole("link", { name: "Página siguiente" })
    ).not.toBeInTheDocument();
  });
  it("does not remove on cancel and removes only after confirmation", async () => {
    const remove = vi.fn().mockResolvedValue({});
    render(
      <ManualBlockForm
        blocks={blocks}
        rooms={rooms}
        create={vi.fn()}
        remove={remove}
        filters={{ status: "active" }}
        page={1}
        total={1}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "Retirar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(remove).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Retirar" }));
    fireEvent.submit(
      screen.getByRole("button", { name: "Confirmar retiro" }).closest("form")!
    );
    await Promise.resolve();
    expect(remove).toHaveBeenCalledOnce();
  });
  it("shows pending and successful result", async () => {
    let resolve!: (value: { ok: boolean }) => void;
    const create = vi.fn(
      () => new Promise<{ ok: boolean }>((r) => (resolve = r))
    );
    render(
      <ManualBlockForm
        blocks={[]}
        rooms={rooms}
        create={create}
        remove={vi.fn()}
        filters={{ status: "active" }}
        page={1}
        total={0}
      />
    );
    fireEvent.submit(screen.getByRole("form", { name: "Crear bloqueos" }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Creando…" })).toBeDisabled();
    resolve({ ok: true });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Bloqueos creados")
    );
  });
  it("sends a custom reason and restores the button after rejection", async () => {
    const create = vi.fn().mockRejectedValue(new Error("failed"));
    render(
      <ManualBlockForm
        blocks={[]}
        rooms={rooms}
        create={create}
        remove={vi.fn()}
        filters={{ status: "active" }}
        page={1}
        total={0}
      />
    );
    fireEvent.change(screen.getByLabelText("Motivo sugerido"), {
      target: { value: "Otro" },
    });
    fireEvent.change(screen.getByLabelText("Motivo libre"), {
      target: { value: "Pintura" },
    });
    fireEvent.submit(screen.getByRole("form", { name: "Crear bloqueos" }));
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("No pudimos crear")
    );
    expect(
      screen.getByRole("button", { name: "Crear bloqueos" })
    ).toBeEnabled();
    expect(create.mock.calls[0]![0].get("reason")).toBe("Pintura");
  });
  it("does not offer removal for a removed block", () => {
    render(
      <ManualBlockForm
        blocks={[
          { ...blocks[0]!, removedAt: new Date(), removedBy: "admin-2" },
        ]}
        rooms={rooms}
        create={vi.fn()}
        remove={vi.fn()}
        filters={{ status: "removed" }}
        page={1}
        total={1}
      />
    );
    expect(
      screen.queryByRole("button", { name: "Retirar" })
    ).not.toBeInTheDocument();
  });
  it("supports keyboard room selection and removal confirmation", async () => {
    const user = userEvent.setup();
    const remove = vi.fn().mockResolvedValue({});
    render(
      <ManualBlockForm
        blocks={blocks}
        rooms={rooms}
        create={vi.fn()}
        remove={remove}
        filters={{ status: "active" }}
        page={1}
        total={1}
      />
    );
    const room = screen.getByLabelText("Valle");
    room.focus();
    await user.keyboard(" ");
    expect(room).toBeChecked();

    const removeButton = screen.getByRole("button", { name: "Retirar" });
    removeButton.focus();
    await user.keyboard("{Enter}");
    expect(screen.getByRole("dialog", { name: "Confirmar retiro" })).toBeVisible();
    await user.tab();
    expect(screen.getByRole("button", { name: "Cancelar" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(remove).not.toHaveBeenCalled();

    removeButton.focus();
    await user.keyboard("{Enter}");
    const confirm = screen.getByRole("button", { name: "Confirmar retiro" });
    confirm.focus();
    await user.keyboard("{Enter}");
    await waitFor(() => expect(remove).toHaveBeenCalledOnce());
  });
  it("shows the conflict summary by date and room, and cancelling never creates or confirms anything", async () => {
    const create = vi.fn();
    const confirm = vi.fn();
    const review = vi.fn().mockResolvedValue({
      kind: "conflicts",
      conflicts: [
        { date: "2035-02-10", roomName: "Valle", source: "reservation" },
        { date: "2035-02-10", roomName: "Terra", source: "hold" },
      ],
    });
    render(
      <ManualBlockForm
        blocks={[]}
        rooms={rooms}
        create={create}
        confirm={confirm}
        review={review}
        remove={vi.fn()}
        filters={{ status: "active" }}
        page={1}
        total={0}
      />
    );
    fireEvent.submit(screen.getByRole("form", { name: "Crear bloqueos" }));
    await waitFor(() => expect(review).toHaveBeenCalledOnce());
    const dialog = await screen.findByRole("dialog", {
      name: "Confirmar conflictos de bloqueo",
    });
    expect(dialog).toHaveTextContent("2035-02-10: Valle (reservation)");
    expect(dialog).toHaveTextContent("2035-02-10: Terra (hold)");
    expect(create).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(
      screen.queryByRole("dialog", { name: "Confirmar conflictos de bloqueo" })
    ).not.toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
    expect(confirm).not.toHaveBeenCalled();
  });
  it("confirms explicitly with the signal set and reports the created blocks", async () => {
    const create = vi.fn();
    const confirm = vi.fn().mockResolvedValue({ ok: true, roomIds: ["room-1"] });
    const review = vi.fn().mockResolvedValue({
      kind: "conflicts",
      conflicts: [{ date: "2035-02-10", roomName: "Valle", source: "reservation" }],
    });
    render(
      <ManualBlockForm
        blocks={[]}
        rooms={rooms}
        create={create}
        confirm={confirm}
        review={review}
        remove={vi.fn()}
        filters={{ status: "active" }}
        page={1}
        total={0}
      />
    );
    fireEvent.submit(screen.getByRole("form", { name: "Crear bloqueos" }));
    await screen.findByRole("dialog", { name: "Confirmar conflictos de bloqueo" });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar bloqueo" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    expect(confirm.mock.calls[0]![0].get("confirmConflicts")).toBe("true");
    expect(create).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Bloqueos confirmados.")
    );
    expect(
      screen.queryByRole("dialog", { name: "Confirmar conflictos de bloqueo" })
    ).not.toBeInTheDocument();
  });
  it("shows a spinner on the confirm button while confirming and disables cancel meanwhile", async () => {
    const create = vi.fn();
    let resolveConfirm!: (value: { ok: boolean }) => void;
    const confirm = vi.fn(
      () => new Promise<{ ok: boolean }>((r) => (resolveConfirm = r))
    );
    const review = vi.fn().mockResolvedValue({
      kind: "conflicts",
      conflicts: [{ date: "2035-02-10", roomName: "Valle", source: "reservation" }],
    });
    render(
      <ManualBlockForm
        blocks={[]}
        rooms={rooms}
        create={create}
        confirm={confirm}
        review={review}
        remove={vi.fn()}
        filters={{ status: "active" }}
        page={1}
        total={0}
      />
    );
    fireEvent.submit(screen.getByRole("form", { name: "Crear bloqueos" }));
    await screen.findByRole("dialog", { name: "Confirmar conflictos de bloqueo" });
    fireEvent.click(screen.getByRole("button", { name: "Confirmar bloqueo" }));
    await waitFor(() => expect(confirm).toHaveBeenCalledOnce());
    const confirmingButton = screen.getByRole("button", { name: "Confirmando…" });
    expect(confirmingButton).toBeDisabled();
    expect(confirmingButton).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
    resolveConfirm({ ok: true });
    await waitFor(() =>
      expect(screen.getByRole("status")).toHaveTextContent("Bloqueos confirmados.")
    );
  });
  it("creates directly without a dialog when the review reports no conflicts", async () => {
    const create = vi.fn().mockResolvedValue({ ok: true, roomIds: ["room-1"] });
    const review = vi.fn().mockResolvedValue({ kind: "clear" });
    render(
      <ManualBlockForm
        blocks={[]}
        rooms={rooms}
        create={create}
        review={review}
        remove={vi.fn()}
        filters={{ status: "active" }}
        page={1}
        total={0}
      />
    );
    fireEvent.submit(screen.getByRole("form", { name: "Crear bloqueos" }));
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(
      screen.queryByRole("dialog", { name: "Confirmar conflictos de bloqueo" })
    ).not.toBeInTheDocument();
  });
});
