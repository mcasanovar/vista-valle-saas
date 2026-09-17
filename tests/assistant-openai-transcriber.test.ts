import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createOpenAiSpeechTranscriber,
  OpenAiSpeechTranscriberError,
} from "@/features/assistant/openai-speech-transcriber";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("OpenAI speech transcriber adapter (task 11.2)", () => {
  it("returns the transcribed text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ text: "Bloquea la habitación Andes" }),
        ok: true,
      })
    );
    const transcriber = createOpenAiSpeechTranscriber("key", "whisper-1");

    const result = await transcriber.transcribe({
      audio: new Blob(["audio"]),
      mimeType: "audio/webm",
    });

    expect(result).toEqual({ text: "Bloquea la habitación Andes" });
  });

  it("throws a typed error on a failed request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => "bad audio",
      })
    );
    const transcriber = createOpenAiSpeechTranscriber("key", "whisper-1");

    await expect(
      transcriber.transcribe({ audio: new Blob(["audio"]), mimeType: "audio/webm" })
    ).rejects.toBeInstanceOf(OpenAiSpeechTranscriberError);
  });
});
