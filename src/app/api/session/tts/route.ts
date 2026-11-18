import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { AI_MODELS, TTS_INSTRUCTIONS, TTS_VOICE } from "@/lib/ai-models";
import {
  CLOSING_TEXT,
  ackFromMessage,
  canSpeakQuestion,
  introText,
  questionSpeech,
} from "@/modules/call/interviewer-script";
import {
  SessionError,
  lastAgentMessage,
  loadActiveSession,
  sessionErrorResponse,
  type ActiveSession,
} from "@/modules/call/server/session";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const MAX_TTS_CHARS = 2000;

// The client only names a part of the interview; the text always comes from
// the server (plan, stored transcript or fixed script), so this endpoint
// cannot speak arbitrary text or pick a voice.
//   ack      — the acknowledgment in the interviewer's latest message
//   question — plan question `index` (the current one or the next, for prefetch)
//   intro / closing — fixed texts; normally played from /public, this is the fallback
const bodySchema = z.discriminatedUnion("part", [
  z.object({ meetingId: z.string().min(1).max(64), part: z.literal("question"), index: z.number().int() }),
  z.object({ meetingId: z.string().min(1).max(64), part: z.enum(["ack", "intro", "closing"]) }),
]);

type Body = z.infer<typeof bodySchema>;

function textFor(body: Body, s: ActiveSession): string {
  const questions = s.plan.map((q) => q.question);

  switch (body.part) {
    case "question":
      if (!canSpeakQuestion(body.index, s.state.userTurns)) {
        throw new SessionError(409, "Esa pregunta todavía no está disponible");
      }
      return questionSpeech(questions[body.index], body.index);
    case "intro":
      return introText(s.agent);
    case "closing":
      return CLOSING_TEXT;
    case "ack": {
      const message = lastAgentMessage(s.items, s.agent.id);
      if (!message) throw new SessionError(409, "No hay mensaje del entrevistador");
      // The latest message was composed after (agentTurns - 1) answers.
      const ack = ackFromMessage(message, s.state.agentTurns - 1, questions);
      if (!ack) throw new SessionError(409, "Este mensaje no tiene acuse");
      return ack;
    }
  }
}

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  // Up to two clips per turn (ack + prefetched question), plus retries.
  if (!rateLimit(`session-tts:${session.user.id}`, 30, 60_000)) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const s = await loadActiveSession(parsed.data.meetingId, session.user.id);
    const text = textFor(parsed.data, s);

    const speech = await openai.audio.speech.create({
      model: AI_MODELS.tts,
      voice: TTS_VOICE,
      instructions: TTS_INSTRUCTIONS,
      input: text.slice(0, MAX_TTS_CHARS),
      response_format: "mp3",
    });

    // Pass the audio through as it is generated instead of buffering it here.
    return new Response(speech.body, {
      headers: { "Content-Type": "audio/mpeg", "Cache-Control": "no-store" },
    });
  } catch (err) {
    return sessionErrorResponse(err);
  }
}
