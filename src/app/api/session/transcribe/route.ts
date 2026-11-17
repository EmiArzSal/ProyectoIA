import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { AI_MODELS } from "@/lib/ai-models";
import { NO_ANSWER, SOFT_TIMER_S } from "@/modules/call/constants";
import {
  SessionError,
  appendTurn,
  loadActiveSession,
  sessionErrorResponse,
} from "@/modules/call/server/session";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// A 60 s answer in Opus/AAC is well under 2 MB; 5 MB leaves room for higher bitrates.
const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const MAX_ANSWER_CHARS = 4000;

// Base MIME type → file extension Whisper recognises.
const ALLOWED_AUDIO: Record<string, string> = {
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "mp4",
  "audio/x-m4a": "m4a",
  "audio/m4a": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
};

/**
 * Records the candidate's answer to the current question. The answer is
 * transcribed and written to the transcript here, on the server; the client
 * never sends answer text. Omitting `audio` records the question as skipped.
 */
export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!rateLimit(`session-transcribe:${session.user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  // Reject oversized uploads before buffering the body.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_AUDIO_BYTES + 64 * 1024) {
    return NextResponse.json({ error: "El audio es demasiado grande" }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const meetingId = formData.get("meetingId");
  if (typeof meetingId !== "string" || meetingId.length === 0 || meetingId.length > 64) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const audio = formData.get("audio");
  let audioFile: File | null = null;
  if (audio !== null) {
    if (!(audio instanceof File) || audio.size === 0) {
      return NextResponse.json({ error: "Audio inválido" }, { status: 400 });
    }
    if (audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: "El audio es demasiado grande" }, { status: 413 });
    }
    const baseType = audio.type.split(";")[0].trim().toLowerCase();
    const ext = ALLOWED_AUDIO[baseType];
    if (!ext) {
      return NextResponse.json({ error: "Formato de audio no soportado" }, { status: 415 });
    }
    audioFile = new File([audio], `answer.${ext}`, { type: baseType });
  }

  try {
    // Grace period: an answer that was being recorded when time ran out is still accepted.
    const s = await loadActiveSession(meetingId, session.user.id, {
      graceMs: (SOFT_TIMER_S + 15) * 1000,
    });
    if (!s.state.canUserAnswer) {
      throw new SessionError(409, "No hay una pregunta pendiente de respuesta");
    }

    let text = "";
    let transcriptionFailed = false;

    if (audioFile) {
      try {
        const transcription = await openai.audio.transcriptions.create({
          file: audioFile,
          model: AI_MODELS.transcription,
          language: "en",
        });
        text = transcription.text.trim().slice(0, MAX_ANSWER_CHARS);
      } catch (err) {
        console.error("[transcribe] Whisper failed for meeting", meetingId, err);
        transcriptionFailed = true;
      }
    }

    // Always record the turn so the interview can move on consistently.
    await appendTurn(s, session.user.id, text || NO_ANSWER);

    return NextResponse.json({ text, transcriptionFailed });
  } catch (err) {
    return sessionErrorResponse(err);
  }
}
