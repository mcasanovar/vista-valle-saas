import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VoiceInputButton } from "@/features/assistant/voice-input-button";

class FakeMediaRecorder {
  mimeType = "audio/webm";
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(private readonly stream: MediaStream) {}

  start() {
    this.ondataavailable?.({ data: new Blob(["fake-audio"]) });
  }

  stop() {
    this.onstop?.();
  }
}

function stubMediaDevices(getUserMedia: () => Promise<MediaStream>) {
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });
}

function fakeStream(): MediaStream {
  return { getTracks: () => [] } as unknown as MediaStream;
}

describe("VoiceInputButton", () => {
  beforeEach(() => {
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", undefined);
  });

  it("reports a denied microphone permission without touching text input state (task 9.1)", async () => {
    stubMediaDevices(() => Promise.reject(new Error("Permission denied")));
    const onError = vi.fn();
    const onTranscribed = vi.fn();
    const user = userEvent.setup();

    render(<VoiceInputButton onError={onError} onTranscribed={onTranscribed} />);
    await user.click(screen.getByRole("button", { name: "Dictar" }));

    expect(onError).toHaveBeenCalledWith(expect.stringContaining("micrófono"));
    expect(onTranscribed).not.toHaveBeenCalled();
  });

  it("places the transcribed text via onTranscribed, without sending anything itself (task 9.3)", async () => {
    stubMediaDevices(() => Promise.resolve(fakeStream()));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ text: "Bloquea la habitación Andes" }),
        ok: true,
      })
    );
    const onTranscribed = vi.fn();
    const user = userEvent.setup();

    render(<VoiceInputButton onError={vi.fn()} onTranscribed={onTranscribed} />);
    await user.click(screen.getByRole("button", { name: "Dictar" }));
    await user.click(screen.getByRole("button", { name: "Detener dictado" }));

    await vi.waitFor(() => {
      expect(onTranscribed).toHaveBeenCalledWith("Bloquea la habitación Andes");
    });
    // Placing text is the only effect — this component never calls the
    // conversation endpoint itself.
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "/api/admin/assistant/transcribe",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("reports a transcription failure without calling onTranscribed (task 9.4)", async () => {
    stubMediaDevices(() => Promise.resolve(fakeStream()));
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        json: async () => ({ error: "No pudimos transcribir el audio." }),
        ok: false,
      })
    );
    const onError = vi.fn();
    const onTranscribed = vi.fn();
    const user = userEvent.setup();

    render(<VoiceInputButton onError={onError} onTranscribed={onTranscribed} />);
    await user.click(screen.getByRole("button", { name: "Dictar" }));
    await user.click(screen.getByRole("button", { name: "Detener dictado" }));

    await vi.waitFor(() => {
      expect(onError).toHaveBeenCalledWith("No pudimos transcribir el audio.");
    });
    expect(onTranscribed).not.toHaveBeenCalled();
  });
});
