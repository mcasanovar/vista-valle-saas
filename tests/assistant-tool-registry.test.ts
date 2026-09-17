import { z } from "zod";
import { describe, expect, it } from "vitest";

import {
  AssistantToolLaneMismatchError,
  createAssistantToolRegistry,
  InvalidAssistantToolArgumentsError,
  UnknownAssistantToolError,
  type AnyAssistantToolDefinition,
  type AssistantToolInvocationContext,
} from "@/features/assistant/tool-registry";

const readContext: AssistantToolInvocationContext = Object.freeze({
  actorUserId: "admin-1",
  operationalContext: Object.freeze({
    rooms: [],
    today: "2030-01-01",
    validManualOrigins: [],
    validReservationStatusTransitions: [],
    validRoomBlockStatuses: [],
  }),
});

const searchAvailabilitySchema = z.object({
  checkIn: z.string(),
  checkOut: z.string(),
});

function buildTools(): readonly AnyAssistantToolDefinition[] {
  return [
    {
      description: "Busca disponibilidad en un rango de fechas.",
      handler: async (input: z.infer<typeof searchAvailabilitySchema>) =>
        Object.freeze({ rooms: [], ...input }),
      lane: "read",
      name: "buscar_disponibilidad",
      schema: searchAvailabilitySchema,
    },
    {
      description: "Crea una reserva manual (propuesta).",
      handler: async (input: unknown) =>
        Object.freeze({ token: "proposal-token", input }),
      lane: "write",
      name: "crear_reserva",
      schema: z.object({ roomId: z.string() }),
    },
  ];
}

describe("assistant tool registry", () => {
  it("derives the model-facing JSON schema from the same Zod schema that validates arguments", () => {
    const registry = createAssistantToolRegistry(buildTools());
    const [availabilityTool] = registry.modelToolDefinitions();

    expect(availabilityTool).toMatchObject({
      name: "buscar_disponibilidad",
      description: "Busca disponibilidad en un rango de fechas.",
    });
    expect(availabilityTool!.parameters).toEqual(
      z.toJSONSchema(searchAvailabilitySchema)
    );

    // The exposed schema must reject exactly what the validator rejects.
    const validation = searchAvailabilitySchema.safeParse({ checkIn: "2030-01-01" });
    expect(validation.success).toBe(false);
  });

  it("executes a read tool with validated, typed arguments", async () => {
    const registry = createAssistantToolRegistry(buildTools());

    const result = await registry.invokeReadTool(
      "buscar_disponibilidad",
      { checkIn: "2030-01-01", checkOut: "2030-01-03" },
      readContext
    );

    expect(result).toEqual({
      rooms: [],
      checkIn: "2030-01-01",
      checkOut: "2030-01-03",
    });
  });

  it("rejects invalid arguments before the handler ever runs", async () => {
    const registry = createAssistantToolRegistry(buildTools());

    await expect(
      registry.invokeReadTool(
        "buscar_disponibilidad",
        { checkIn: "2030-01-01" },
        readContext
      )
    ).rejects.toBeInstanceOf(InvalidAssistantToolArgumentsError);
  });

  it("refuses to invoke a write-lane tool as a read tool", async () => {
    const registry = createAssistantToolRegistry(buildTools());

    await expect(
      registry.invokeReadTool("crear_reserva", { roomId: "room-1" }, readContext)
    ).rejects.toBeInstanceOf(AssistantToolLaneMismatchError);
  });

  it("refuses to invoke a read-lane tool as a write tool", async () => {
    const registry = createAssistantToolRegistry(buildTools());

    await expect(
      registry.invokeWriteTool(
        "buscar_disponibilidad",
        { checkIn: "2030-01-01", checkOut: "2030-01-03" },
        readContext
      )
    ).rejects.toBeInstanceOf(AssistantToolLaneMismatchError);
  });

  it("rejects an unknown tool name", async () => {
    const registry = createAssistantToolRegistry(buildTools());

    await expect(
      registry.invokeReadTool("no_existe", {}, readContext)
    ).rejects.toBeInstanceOf(UnknownAssistantToolError);
  });
});
