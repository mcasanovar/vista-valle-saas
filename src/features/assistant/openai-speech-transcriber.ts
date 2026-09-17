import "server-only";

import type {
  SpeechTranscriber,
  TranscribeAudioInput,
} from "./speech-transcriber";

export class OpenAiSpeechTranscriberError extends Error {
  constructor(status: number, body: string) {
    super(`OpenAI transcription request failed (${status}): ${body}`);
    this.name = "OpenAiSpeechTranscriberError";
  }
}

/**
 * `SpeechTranscriber` adapter for OpenAI's audio transcription API
 * (task 11.2), used only when `AI_PROVIDER` is `"openai"`.
 */
export function createOpenAiSpeechTranscriber(
  apiKey: string,
  model: string
): SpeechTranscriber {
  return Object.freeze({
    async transcribe(input: TranscribeAudioInput) {
      const formData = new FormData();
      formData.append("file", input.audio, "audio");
      formData.append("model", model);

      const response = await fetch(
        "https://api.openai.com/v1/audio/transcriptions",
        {
          body: formData,
          headers: { Authorization: `Bearer ${apiKey}` },
          method: "POST",
        }
      );

      if (!response.ok) {
        throw new OpenAiSpeechTranscriberError(response.status, await response.text());
      }

      const body = (await response.json()) as { text?: string };
      return Object.freeze({ text: body.text ?? "" });
    },
  });
}
