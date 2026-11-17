import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { AI_MODELS, TTS_INSTRUCTIONS, TTS_VOICE } from "@/lib/ai-models";
import {
  SessionError,
  lastAgentMessage,
  loadActiveSession,
  sessionErrorResponse,
} from "@/modules/call/server/session";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const MAX_TTS_CHARS = 2000;

// Only the interviewer's latest message in an active meeting can be spoken;
// the client cannot send arbitrary text or pick a voice.
const bodySchema = z.object({ meetingId: z.string().min(1).max(64) });

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!rateLimit(`session-tts:${session.user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const s = await loadActiveSession(parsed.data.meetingId, session.user.id);
    const text = lastAgentMessage(s.items, s.agent.id);
    if (!text) throw new SessionError(409, "No hay mensaje del entrevistador");

    const mp3 = await openai.audio.speech.create({
      model: AI_MODELS.tts,
      voice: TTS_VOICE,
      instructions: TTS_INSTRUCTIONS,
      input: text.slice(0, MAX_TTS_CHARS),
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    return new Response(buffer, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return sessionErrorResponse(err);
  }
}
