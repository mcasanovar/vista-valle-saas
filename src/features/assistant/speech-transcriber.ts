import "server-only";

export type TranscribeAudioInput = Readonly<{
  audio: Blob;
  mimeType: string;
}>;

export type TranscribeAudioResult = Readonly<{
  text: string;
}>;

/**
 * Port for speech-to-text (design.md decision 7). The browser records
 * audio and uploads it to an authenticated server endpoint; this port is
 * what that endpoint calls, so the transcription provider is configuration
 * (`AI_TRANSCRIPTION_MODEL`), not a hardcoded dependency.
 */
export type SpeechTranscriber = Readonly<{
  transcribe(input: TranscribeAudioInput): Promise<TranscribeAudioResult>;
}>;
