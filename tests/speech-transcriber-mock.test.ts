import { describe, expect, it } from "vitest";

import { createScriptedSpeechTranscriber } from "@/features/assistant/speech-transcriber-mock";

describe("scripted speech transcriber", () => {
  it("returns the scripted text regardless of the audio given", async () => {
    const transcriber = createScriptedSpeechTranscriber(
      "Bloquea la habitación Andes para mantenimiento"
    );

    const result = await transcriber.transcribe({
      audio: new Blob(["not real audio"]),
      mimeType: "audio/webm",
    });

    expect(result).toEqual({
      text: "Bloquea la habitación Andes para mantenimiento",
    });
  });

  it("returns the same scripted text on repeated calls", async () => {
    const transcriber = createScriptedSpeechTranscriber("Listo.");

    const first = await transcriber.transcribe({
      audio: new Blob(["a"]),
      mimeType: "audio/webm",
    });
    const second = await transcriber.transcribe({
      audio: new Blob(["b"]),
      mimeType: "audio/wav",
    });

    expect(first.text).toBe("Listo.");
    expect(second.text).toBe("Listo.");
  });
});
