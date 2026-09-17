import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AssistantProposalCard } from "@/features/assistant/proposal-card";

const payload = Object.freeze({
  checkIn: "2050-01-01",
  checkOut: "2050-01-03",
  roomId: "demo-room-andes",
});

describe("AssistantProposalCard (task 8.4)", () => {
  it("shows the operation and its values, and calls neither action before a click", () => {
    const confirm = vi.fn();
    const cancel = vi.fn();
    render(
      <AssistantProposalCard
        cancel={cancel}
        confirm={confirm}
        onResolved={vi.fn()}
        operation="crear_bloqueo"
        payload={payload}
        token="token-1"
      />
    );

    expect(screen.getByText("demo-room-andes")).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
    expect(cancel).not.toHaveBeenCalled();
  });

  it("only calls confirm — and only then applies anything — when the administrator presses Confirmar", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn().mockResolvedValue({ ok: true });
    const cancel = vi.fn();
    const onResolved = vi.fn();

    render(
      <AssistantProposalCard
        cancel={cancel}
        confirm={confirm}
        onResolved={onResolved}
        operation="crear_bloqueo"
        payload={payload}
        token="token-1"
      />
    );

    expect(confirm).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Confirmar" }));

    expect(confirm).toHaveBeenCalledWith("token-1");
    expect(cancel).not.toHaveBeenCalled();
    expect(await screen.findByText("Propuesta confirmada")).toBeInTheDocument();
  });

  it("only calls cancel when the administrator presses Cancelar, and never touches confirm", async () => {
    const user = userEvent.setup();
    const confirm = vi.fn();
    const cancel = vi.fn().mockResolvedValue(undefined);

    render(
      <AssistantProposalCard
        cancel={cancel}
        confirm={confirm}
        onResolved={vi.fn()}
        operation="crear_bloqueo"
        payload={payload}
        token="token-1"
      />
    );

    await user.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(cancel).toHaveBeenCalledWith("token-1");
    expect(confirm).not.toHaveBeenCalled();
    expect(await screen.findByText("Propuesta cancelada")).toBeInTheDocument();
  });
});
