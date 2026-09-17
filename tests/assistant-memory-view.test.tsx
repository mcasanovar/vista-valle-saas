import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AssistantMemoryView } from "@/features/assistant/memory-view";

describe("AssistantMemoryView (task 10.3)", () => {
  it("edits a fact in place", async () => {
    const updateFact = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <AssistantMemoryView
        deleteFact={vi.fn()}
        facts={[{ fact: "La suite grande se llama Andes", id: "fact-1" }]}
        updateFact={updateFact}
      />
    );

    await user.click(screen.getByRole("button", { name: "Editar" }));
    const textarea = screen.getByLabelText(
      "Editar hecho: La suite grande se llama Andes"
    );
    await user.clear(textarea);
    await user.type(textarea, "La suite grande se llama Valle");
    await user.click(screen.getByRole("button", { name: "Guardar" }));

    expect(updateFact).toHaveBeenCalledWith(
      "fact-1",
      "La suite grande se llama Valle"
    );
    expect(
      await screen.findByText("La suite grande se llama Valle")
    ).toBeInTheDocument();
  });

  it("a deleted fact is removed from the view — the next prompt build will no longer see it", async () => {
    const deleteFact = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();

    render(
      <AssistantMemoryView
        deleteFact={deleteFact}
        facts={[{ fact: "La suite grande se llama Andes", id: "fact-1" }]}
        updateFact={vi.fn()}
      />
    );

    expect(screen.getByText("La suite grande se llama Andes")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Borrar" }));

    expect(deleteFact).toHaveBeenCalledWith("fact-1");
    expect(
      screen.queryByText("La suite grande se llama Andes")
    ).not.toBeInTheDocument();
  });
});
