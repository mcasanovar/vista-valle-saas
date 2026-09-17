"use client";

import { useRef, useState } from "react";
import { Button } from "@/presentation/atoms";

export type VoiceInputButtonProps = Readonly<{
  disabled?: boolean;
  onError: (message: string) => void;
  onTranscribed: (text: string) => void;
}>;

/**
 * Voice dictation (task 9.1): records with `MediaRecorder` and uploads the
 * audio for transcription. A denied microphone permission — or any
 * transcription failure — only reports the error through `onError`; it
 * never touches the text input, which stays fully usable either way
 * (task 9.4).
 */
export function VoiceInputButton({
  disabled,
  onError,
  onTranscribed,
}: VoiceInputButtonProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function transcribe(blob: Blob) {
    setTranscribing(true);
    try {
      const response = await fetch("/api/admin/assistant/transcribe", {
        body: blob,
        headers: { "Content-Type": blob.type || "audio/webm" },
        method: "POST",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        onError(
          body?.error ??
            "No pudimos transcribir el audio. Puedes escribir tu instrucción."
        );
        return;
      }
      const body = (await response.json()) as { text: string };
      onTranscribed(body.text);
    } catch {
      onError(
        "No pudimos transcribir el audio. Puedes escribir tu instrucción."
      );
    } finally {
      setTranscribing(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        for (const track of stream.getTracks()) track.stop();
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        void transcribe(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      onError(
        "No pudimos acceder al micrófono. Puedes seguir escribiendo tu instrucción."
      );
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <Button
      aria-pressed={recording}
      disabled={disabled || transcribing}
      loading={transcribing}
      onClick={recording ? stopRecording : () => void startRecording()}
      type="button"
      variant="secondary"
    >
      {recording ? "Detener dictado" : "Dictar"}
    </Button>
  );
}
