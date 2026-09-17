import "server-only";

import { getServerEnvironment } from "@/config/server";

import { createScriptedSpeechTranscriber } from "./speech-transcriber-mock";
import { createOpenAiSpeechTranscriber } from "./openai-speech-transcriber";
import type { SpeechTranscriber } from "./speech-transcriber";

/**
 * Resolves the configured `SpeechTranscriber` from
 * `AI_PROVIDER`/`AI_TRANSCRIPTION_MODEL` (task 11.2), mirroring
 * `model-provider.ts`'s same reasoning: only `AI_PROVIDER=openai` uses the
 * real adapter, so the test suite and mock-context development never hit
 * the network.
 */
export function getSpeechTranscriber(): SpeechTranscriber {
  const environment = getServerEnvironment();
  if (environment.AI_PROVIDER === "openai") {
    return createOpenAiSpeechTranscriber(
      environment.AI_API_KEY,
      environment.AI_TRANSCRIPTION_MODEL
    );
  }
  return createScriptedSpeechTranscriber(
    "El servicio de transcripción todavía no está configurado."
  );
}
