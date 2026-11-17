import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { AI_MODELS, INTERVIEWER_MAX_TOKENS } from "@/lib/ai-models";
import {
  SessionError,
  appendTurn,
  buildSystemPrompt,
  loadActiveSession,
  sessionErrorResponse,
  toChatHistory,
} from "@/modules/call/server/session";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

// The client only says which meeting it is in. The system prompt, the history
// and the interview progress are all derived on the server from the stored
// transcript, so this endpoint cannot be used as a general-purpose LLM proxy.
const bodySchema = z.object({ meetingId: z.string().min(1).max(64) });

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (!rateLimit(`session-message:${session.user.id}`, 20, 60_000)) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  try {
    const s = await loadActiveSession(parsed.data.meetingId, session.user.id);
    if (!s.state.canAgentRespond) {
      throw new SessionError(409, "No es el turno del entrevistador");
    }

    const completion = await openai.chat.completions.create({
      model: AI_MODELS.interviewer,
      max_tokens: INTERVIEWER_MAX_TOKENS,
      messages: [
        { role: "system", content: buildSystemPrompt(s.agent, s.state.userTurns) },
        ...toChatHistory(s.items, s.agent.id),
      ],
    });

    const text = completion.choices[0]?.message.content?.trim();
    if (!text) throw new SessionError(502, "El entrevistador no respondió");

    await appendTurn(s, s.agent.id, text);
    return NextResponse.json({ text });
  } catch (err) {
    return sessionErrorResponse(err);
  }
}
