import "server-only";

import type { SpeechTranscriber } from "./speech-transcriber";

/**
 * Deterministic `SpeechTranscriber` for tests and mock-context development:
 * always returns the same scripted text, regardless of the audio given —
 * never calls a real provider.
 */
export function createScriptedSpeechTranscriber(
  scriptedText: string
): SpeechTranscriber {
  return Object.freeze({
    async transcribe() {
      return Object.freeze({ text: scriptedText });
    },
  });
}
