import { describe, expect, it } from "vitest";

import {
  buildAssistantPromptPrefix,
  type AssistantPromptPrefixInput,
} from "@/features/assistant/prompt";
import type { AssistantOperationalContext } from "@/features/assistant/operational-context";

function operationalContext(
  overrides: Partial<AssistantOperationalContext> = {}
): AssistantOperationalContext {
  return Object.freeze({
    rooms: [
      { capacity: 2, id: "room-b", name: "Habitación Valle", nightlyPriceClp: 60_000 },
      { capacity: 4, id: "room-a", name: "Habitación Andes", nightlyPriceClp: 90_000 },
    ],
    today: "2030-06-15",
    validManualOrigins: ["phone", "admin"],
    validReservationStatusTransitions: ["cancelled", "completed", "no_show"],
    validRoomBlockStatuses: ["active", "removed"],
    ...overrides,
  });
}

function promptInput(
  overrides: Partial<AssistantPromptPrefixInput> = {}
): AssistantPromptPrefixInput {
  return Object.freeze({
    memoryFacts: ["La suite grande se llama 'la del jacuzzi'."],
    operationalContext: operationalContext(),
    tools: [
      { description: "Busca disponibilidad.", name: "buscar_disponibilidad", parameters: {} },
    ],
    ...overrides,
  });
}

describe("assistant prompt prefix", () => {
  it("is byte-for-byte identical across two calls on the same day with the same data", () => {
    const first = buildAssistantPromptPrefix(promptInput());
    const second = buildAssistantPromptPrefix(promptInput());

    expect(first).toBe(second);
  });

  it("is identical regardless of the input rooms' order", () => {
    const context = operationalContext();
    const reorderedContext = operationalContext({
      rooms: [...context.rooms].reverse(),
    });

    const first = buildAssistantPromptPrefix(
      promptInput({ operationalContext: context })
    );
    const second = buildAssistantPromptPrefix(
      promptInput({ operationalContext: reorderedContext })
    );

    expect(first).toBe(second);
  });

  it("changes when today's date changes", () => {
    const first = buildAssistantPromptPrefix(promptInput());
    const second = buildAssistantPromptPrefix(
      promptInput({ operationalContext: operationalContext({ today: "2030-06-16" }) })
    );

    expect(first).not.toBe(second);
  });

  it("changes when a memory fact is added, and reflects it", () => {
    const first = buildAssistantPromptPrefix(promptInput());
    const second = buildAssistantPromptPrefix(
      promptInput({ memoryFacts: ["Nuevo hecho enseñado."] })
    );

    expect(first).not.toBe(second);
    expect(second).toContain("Nuevo hecho enseñado.");
  });

  it("includes every tool's name and description", () => {
    const prefix = buildAssistantPromptPrefix(promptInput());
    expect(prefix).toContain("buscar_disponibilidad");
    expect(prefix).toContain("Busca disponibilidad.");
  });
});
