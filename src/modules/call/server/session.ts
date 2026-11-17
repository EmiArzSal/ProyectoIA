import "server-only";

import { NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import JSONL from "jsonl-parse-stringify";
import type { ChatCompletionMessageParam } from "openai/resources/index.mjs";

import { db } from "@/db";
import { meetings } from "@/db/schema";
import { getPredefinedAgent, type PredefinedAgent } from "@/lib/predefined-agents";
import type { StreamTranscriptItem } from "@/modules/meetings/types";
import { MAX_SESSION_MS, NO_ANSWER, TECH_QUESTIONS, TOTAL_QUESTIONS } from "../constants";

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

  const items = parseTranscript(meeting.transcriptUrl);
  return { meeting, agent, items, state: getSessionState(items, agent.id) };
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

export function buildSystemPrompt(agent: PredefinedAgent, userTurns: number): string {
  let progress: string;

  if (userTurns === 0) {
    progress = `Start with a brief introduction and ask your first TECHNICAL question. The interview has ${TOTAL_QUESTIONS} questions total: ${TECH_QUESTIONS} technical first, then ${TOTAL_QUESTIONS - TECH_QUESTIONS} behavioral. Do NOT close the interview yet.`;
  } else if (userTurns >= TOTAL_QUESTIONS) {
    progress = `The candidate just answered question ${TOTAL_QUESTIONS} of ${TOTAL_QUESTIONS} (the last one). Acknowledge their answer and close the interview professionally. Do NOT ask any more questions.`;
  } else {
    const nextQ = userTurns + 1;
    const type = nextQ <= TECH_QUESTIONS ? "TECHNICAL" : "BEHAVIORAL";
    progress = `The candidate just answered question ${userTurns} of ${TOTAL_QUESTIONS}. Acknowledge briefly and ask question ${nextQ} of ${TOTAL_QUESTIONS}, which must be a ${type} question. Do NOT close the interview — there are still ${TOTAL_QUESTIONS - nextQ} questions remaining after this one.`;
  }

  return `${agent.instructions}\n\n---\nINTERVIEW PROGRESS: ${progress}\nIf an answer is "${NO_ANSWER}", the candidate skipped that question; do not comment on it at length, just move on.`;
}

export function toChatHistory(items: StreamTranscriptItem[], agentId: string): ChatCompletionMessageParam[] {
  return items.map((item) => ({
    role: item.speaker_id === agentId ? "assistant" : "user",
    content: item.text,
  }));
}

export function lastAgentMessage(items: StreamTranscriptItem[], agentId: string): string | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].speaker_id === agentId) return items[i].text;
  }
  return undefined;
}
