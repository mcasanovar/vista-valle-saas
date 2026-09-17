import "server-only";

import { getServerEnvironment } from "@/config/server";

import { createScriptedAssistantModel } from "./assistant-model-mock";
import { createOpenAiAssistantModel } from "./openai-assistant-model";
import type { AssistantModel } from "./assistant-model";

/**
 * Resolves the configured `AssistantModel` from `AI_PROVIDER`/`AI_MODEL`
 * (task 11.1). Every context other than `AI_PROVIDER=openai` still uses
 * the deterministic mock — this is what keeps the full test suite (and
 * mock-context development) free of network calls and credentials.
 */
export function getAssistantModel(): AssistantModel {
  const environment = getServerEnvironment();
  if (environment.AI_PROVIDER === "openai") {
    return createOpenAiAssistantModel(environment.AI_API_KEY, environment.AI_MODEL);
  }
  return createScriptedAssistantModel([
    {
      kind: "text",
      text: "El proveedor de IA todavía no está configurado para este asistente.",
    },
  ]);
}
