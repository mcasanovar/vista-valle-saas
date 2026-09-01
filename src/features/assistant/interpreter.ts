import "server-only";
import { getServerEnvironment } from "@/config/server";
import type { RoomReadModel } from "@/features/rooms";
import {
  parseCreateRoomBlockProposal,
  type CreateRoomBlockProposal,
} from "./room-block-proposal";
export class AssistantProviderUnavailableError extends Error {
  readonly code = "ASSISTANT_PROVIDER_UNAVAILABLE" as const;
}
export class AssistantStructuredOutputError extends Error {
  readonly code = "ASSISTANT_STRUCTURED_OUTPUT_INVALID" as const;
}
export type RoomBlockInterpreter = Readonly<{
  interpret: (
    input: string,
    rooms: readonly RoomReadModel[]
  ) => Promise<CreateRoomBlockProposal>;
}>;
export function createMockRoomBlockInterpreter(
  output: unknown
): RoomBlockInterpreter {
  return Object.freeze({
    interpret: async (_input, rooms) => {
      try {
        return parseCreateRoomBlockProposal(output, rooms);
      } catch {
        throw new AssistantStructuredOutputError(
          "Invalid structured assistant output"
        );
      }
    },
  });
}
export function getRoomBlockInterpreter(): RoomBlockInterpreter {
  if (getServerEnvironment().VISTA_VALLE_CONFIG_CONTEXT !== "mock")
    throw new AssistantProviderUnavailableError(
      "Assistant provider unavailable"
    );
  throw new AssistantProviderUnavailableError(
    "Mock interpreter must be injected"
  );
}
