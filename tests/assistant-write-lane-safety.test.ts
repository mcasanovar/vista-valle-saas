import { describe, expect, it } from "vitest";

import {
  AssistantToolLaneMismatchError,
  createAssistantToolRegistry,
} from "@/features/assistant/tool-registry";
import type { AssistantToolInvocationContext } from "@/features/assistant/tool-registry";
import { createWriteAssistantTools } from "@/features/assistant/tools/write";

const context: AssistantToolInvocationContext = Object.freeze({
  actorUserId: "admin-lane-safety",
  operationalContext: Object.freeze({
    rooms: [],
    today: "2030-01-01",
    validManualOrigins: [],
    validReservationStatusTransitions: [],
    validRoomBlockStatuses: [],
  }),
});

describe("write-lane tools (task 6.10)", () => {
  const writeTools = createWriteAssistantTools();

  it.each(writeTools.map((tool) => tool.name))(
    "%s cannot be invoked through invokeReadTool — no path from the agent loop to it",
    async (name) => {
      const registry = createAssistantToolRegistry(writeTools);
      await expect(
        registry.invokeReadTool(name, {}, context)
      ).rejects.toBeInstanceOf(AssistantToolLaneMismatchError);
    }
  );

  it("every write tool is declared on the write lane", () => {
    for (const tool of writeTools) {
      expect(tool.lane).toBe("write");
    }
  });

  it("crear_bloqueo's only output is a proposal token, never a created block id", async () => {
    const [createBlockTool] = writeTools.filter((tool) => tool.name === "crear_bloqueo");
    const result = (await createBlockTool!.handler(
      {
        checkIn: "2050-07-01",
        checkOut: "2050-07-03",
        reason: "Mantenimiento",
        roomIds: ["demo-room-valle"],
      },
      context
    )) as Record<string, unknown>;

    expect(result).toHaveProperty("token");
    expect(result).not.toHaveProperty("blockId");
    expect(result).not.toHaveProperty("blockIds");
  });
});
