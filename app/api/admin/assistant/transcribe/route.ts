import { getServerEnvironment } from "@/config/server";
import { requireAdministrator } from "@/infrastructure/auth/authorization";
import { getSpeechTranscriber } from "@/features/assistant/transcriber-provider";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Authenticated audio-transcription endpoint (task 9.2). The browser
 * records with `MediaRecorder` and uploads the audio here; the server
 * transcribes it and returns plain text — the client places it in the
 * instruction field, editable, never auto-sent (task 9.3).
 */
export async function POST(request: Request) {
  try {
    await requireAdministrator();
  } catch {
    return Response.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!getServerEnvironment().ASSISTANT_ENABLED) {
    return Response.json({ error: "Asistente no disponible" }, { status: 404 });
  }

  const contentType = request.headers.get("Content-Type") ?? "audio/webm";
  const audio = await request.blob().catch(() => null);
  if (!audio || audio.size === 0) {
    return Response.json({ error: "Audio inválido" }, { status: 400 });
  }

  try {
    const transcriber = getSpeechTranscriber();
    const result = await transcriber.transcribe({ audio, mimeType: contentType });
    return Response.json({ text: result.text });
  } catch {
    return Response.json(
      { error: "No pudimos transcribir el audio. Intenta escribir tu instrucción." },
      { status: 502 }
    );
  }
}
