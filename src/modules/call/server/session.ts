import "server-only";

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import JSONL from "jsonl-parse-stringify";

import { db } from "@/db";
import { meetings } from "@/db/schema";
import { getPredefinedAgent, type PredefinedAgent } from "@/lib/predefined-agents";
import type { StreamTranscriptItem } from "@/modules/meetings/types";
import { MAX_SESSION_MS, NO_ANSWER, TOTAL_QUESTIONS } from "../constants";
import { loadPlan, type StoredQuestion } from "./plan";

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

export type SessionState = {
  userTurns: number;
  agentTurns: number;
  /** The interviewer may produce its next message (intro, next question or closing). */
  canAgentRespond: boolean;
  /** The candidate may submit an answer (main round or review of skipped questions). */
  canUserAnswer: boolean;
};

export type ActiveSession = {
  meeting: Meeting;
  agent: PredefinedAgent;
  plan: StoredQuestion[];
  items: StreamTranscriptItem[];
  state: SessionState;
};

export function parseTranscript(raw: string | null): StreamTranscriptItem[] {
  const text = raw?.trim();
  if (!text) return [];
  try {
    return JSONL.parse<StreamTranscriptItem>(text);
  } catch {
    throw new SessionError(500, "Transcripción corrupta");
  }
}

export function getSessionState(items: StreamTranscriptItem[], agentId: string): SessionState {
  const userItems = items.filter((i) => i.speaker_id !== agentId);
  const userTurns = userItems.length;
  const agentTurns = items.length - userTurns;
  const last = items.at(-1);

  const skippedInMainRound = userItems
    .slice(0, TOTAL_QUESTIONS)
    .filter((i) => i.text === NO_ANSWER).length;

  const canAgentRespond =
    (agentTurns === 0 && userTurns === 0) ||
    (last !== undefined &&
      last.speaker_id !== agentId &&
      userTurns <= TOTAL_QUESTIONS &&
      agentTurns === userTurns);

  const inMainRound = userTurns < TOTAL_QUESTIONS && agentTurns === userTurns + 1;
  const inReviewRound =
    agentTurns === TOTAL_QUESTIONS + 1 &&
    userTurns >= TOTAL_QUESTIONS &&
    userTurns < TOTAL_QUESTIONS + skippedInMainRound;

  return {
    userTurns,
    agentTurns,
    canAgentRespond,
    canUserAnswer: inMainRound || inReviewRound,
  };
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

  const items = parseTranscript(meeting.transcriptUrl);
  return { meeting, agent, plan, items, state: getSessionState(items, agent.id) };
}

/**
 * Appends one turn using optimistic concurrency: the write only succeeds if the
 * transcript is still exactly what we read, so concurrent/duplicate requests
 * cannot add extra turns.
 */
export async function appendTurn(session: ActiveSession, speakerId: string, text: string) {
  const { meeting, items } = session;
  const startedAt = meeting.startedAt?.getTime() ?? Date.now();
  const ts = Math.max(0, Date.now() - startedAt);

  const next = [...items, { speaker_id: speakerId, type: "text", text, start_ts: ts, stop_ts: ts }]
    .map((item) => JSON.stringify(item))
    .join("\n");

  const [updated] = await db
    .update(meetings)
    .set({ transcriptUrl: next, updatedAt: new Date() })
    .where(and(
      eq(meetings.id, meeting.id),
      eq(meetings.userId, meeting.userId),
      eq(meetings.status, "active"),
      sql`${meetings.transcriptUrl} IS NOT DISTINCT FROM ${meeting.transcriptUrl}::text`,
    ))
    .returning({ id: meetings.id });

  if (!updated) {
    throw new SessionError(409, "La entrevista cambió de estado. Intenta de nuevo.");
  }
}

export function lastAgentMessage(items: StreamTranscriptItem[], agentId: string): string | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].speaker_id === agentId) return items[i].text;
  }
  return undefined;
}
