import "server-only";

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import JSONL from "jsonl-parse-stringify";

import { db } from "@/db";
import { meetings } from "@/db/schema";
import { getPredefinedAgent, type PredefinedAgent } from "@/lib/predefined-agents";
import type { TranscriptItem } from "@/modules/meetings/types";
import { MAX_SESSION_MS, TOTAL_QUESTIONS } from "../constants";
import { loadPlan, type StoredQuestion } from "./plan";
import { getSessionState, type SessionState } from "../session-rules";
export { getSessionState, lastAgentMessage, type SessionState } from "../session-rules";

// The server is the single source of truth for an interview in progress:
// the transcript is built here turn by turn (stored as JSONL in
// meetings.transcript_url) and every request is checked against it, so the
// client can neither inject prompts nor forge answers.

export class SessionError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export function sessionErrorResponse(err: unknown) {
  if (err instanceof SessionError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error("[session]", err);
  return NextResponse.json({ error: "Error interno" }, { status: 500 });
}

type Meeting = typeof meetings.$inferSelect;


export type ActiveSession = {
  meeting: Meeting;
  agent: PredefinedAgent;
  plan: StoredQuestion[];
  items: TranscriptItem[];
  state: SessionState;
};

export function parseTranscript(raw: string | null): TranscriptItem[] {
  const text = raw?.trim();
  if (!text) return [];
  try {
    return JSONL.parse<TranscriptItem>(text);
  } catch {
    throw new SessionError(500, "Transcripción corrupta");
  }
}

export async function loadActiveSession(
  meetingId: string,
  userId: string,
  opts: { graceMs?: number } = {},
): Promise<ActiveSession> {
  const [meeting] = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)));

  if (!meeting) throw new SessionError(404, "Entrevista no encontrada");
  if (meeting.status !== "active") throw new SessionError(409, "La entrevista no está en curso");

  // Hard time limit for the whole interview, measured on the server.
  const startedAt = meeting.startedAt?.getTime() ?? 0;
  if (Date.now() > startedAt + MAX_SESSION_MS + (opts.graceMs ?? 0)) {
    throw new SessionError(410, "Se acabó el tiempo de la entrevista");
  }

  const agent = getPredefinedAgent(meeting.agentId);
  if (!agent) throw new SessionError(404, "Agente no encontrado");

  const plan = await loadPlan(meeting.id);
  if (plan.length !== TOTAL_QUESTIONS) {
    // Interviews started before question plans existed cannot continue.
    throw new SessionError(409, "Esta entrevista se inició con una versión anterior. Finalízala para ver el reporte.");
  }

  const items = parseTranscript(meeting.transcript);
  return { meeting, agent, plan, items, state: getSessionState(items, agent.id) };
}

/**
 * Appends one turn using optimistic concurrency: the write only succeeds if the
 * transcript is still exactly what we read, so concurrent/duplicate requests
 * cannot add extra turns. Returns the updated session.
 */
export async function appendTurn(session: ActiveSession, speakerId: string, text: string): Promise<ActiveSession> {
  const { meeting, items } = session;
  const startedAt = meeting.startedAt?.getTime() ?? Date.now();
  const ts = Math.max(0, Date.now() - startedAt);

  const nextItems = [...items, { speaker_id: speakerId, type: "text", text, start_ts: ts, stop_ts: ts }];
  const next = nextItems.map((item) => JSON.stringify(item)).join("\n");

  const [updated] = await db
    .update(meetings)
    .set({ transcript: next, updatedAt: new Date() })
    .where(and(
      eq(meetings.id, meeting.id),
      eq(meetings.userId, meeting.userId),
      eq(meetings.status, "active"),
      sql`${meetings.transcript} IS NOT DISTINCT FROM ${meeting.transcript}::text`,
    ))
    .returning({ id: meetings.id });

  if (!updated) {
    throw new SessionError(409, "La entrevista cambió de estado. Intenta de nuevo.");
  }

  // The session as it is now, so a second turn can be appended in the same request.
  return {
    ...session,
    meeting: { ...meeting, transcript: next },
    items: nextItems,
    state: getSessionState(nextItems, session.agent.id),
  };
}
