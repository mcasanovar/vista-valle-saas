import "server-only";

import type { AssistantModel, AssistantModelTurnResult } from "./assistant-model";

export class AssistantModelScriptExhaustedError extends Error {
  constructor() {
    super("Scripted assistant model has no more turns queued");
    this.name = "AssistantModelScriptExhaustedError";
  }
}

/**
 * Deterministic `AssistantModel` for tests and mock-context development
 * (design.md decision 8, mirroring `createMockRoomBlockInterpreter`): each
 * call to `runTurn` returns the next scripted result in order, regardless
 * of the actual `input` — never calls a real provider, so the full test
 * suite runs in CI without network access or credentials.
 */
export function createScriptedAssistantModel(
  script: readonly AssistantModelTurnResult[]
): AssistantModel {
  let cursor = 0;
  return Object.freeze({
    async runTurn(): Promise<AssistantModelTurnResult> {
      if (cursor >= script.length)
        throw new AssistantModelScriptExhaustedError();
      const result = script[cursor];
      cursor += 1;
      return result!;
    },
  });
}
