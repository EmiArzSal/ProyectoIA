// Pure rules of the interview flow: whose turn it is, how answers map to the
// question plan, and whether a generated question is usable. No DB, network
// or server-only imports, so they are unit-tested in session-rules.test.ts.
// server/session.ts and server/plan.ts re-export them.

import type { StreamTranscriptItem } from "@/modules/meetings/types";
import { NO_ANSWER, TOTAL_QUESTIONS } from "./constants";

export type QuestionKind = "technical" | "soft";

export type SessionState = {
  userTurns: number;
  agentTurns: number;
  /** The interviewer may produce its next message (intro, next question or closing). */
  canAgentRespond: boolean;
  /** The candidate may submit an answer (main round or review of skipped questions). */
  canUserAnswer: boolean;
};

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

export function lastAgentMessage(items: StreamTranscriptItem[], agentId: string): string | undefined {
  for (let i = items.length - 1; i >= 0; i--) {
    if (items[i].speaker_id === agentId) return items[i].text;
  }
  return undefined;
}

/** Spoken-question sanity check; anything off falls back to the seed. */
export function isUsableQuestion(text: string, avoid: string[] = [], kind: QuestionKind = "technical"): boolean {
  const q = text.trim();
  if (q.length < 10 || q.length > 260) return false;
  const marks = (q.match(/\?/g) ?? []).length;
  const singleQuestion = marks === 1 && q.endsWith("?");
  // Behavioral prompts may also be a "Tell me about…" statement.
  const behavioralPrompt = kind === "soft" && marks === 0 && q.endsWith(".");
  if (!singleQuestion && !behavioralPrompt) return false;
  if (/[`{}<>;=]|\n/.test(q)) return false; // looks like code or a list
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
  return !avoid.some((a) => norm(a) === norm(q));
}

/**
 * Maps the candidate's turns to plan positions. The session state machine
 * guarantees the order: the first 10 answers belong to questions 1–10, and any
 * extra answers (review round) belong to the skipped questions, in order.
 * A review answer replaces the skipped one.
 */
export function mapAnswersToPlan(
  items: Pick<StreamTranscriptItem, "speaker_id" | "text">[],
  agentId: string,
  planSize: number,
): Map<number, string> {
  const answers = items.filter((i) => i.speaker_id !== agentId).map((i) => i.text);
  const result = new Map<number, string>();

  answers.slice(0, planSize).forEach((text, i) => result.set(i + 1, text));

  const skipped = [...result.entries()].filter(([, t]) => t === NO_ANSWER).map(([pos]) => pos);
  answers.slice(planSize).forEach((text, i) => {
    const pos = skipped[i];
    if (pos !== undefined && text !== NO_ANSWER) result.set(pos, text);
  });

  for (let pos = 1; pos <= planSize; pos++) {
    if (!result.has(pos)) result.set(pos, NO_ANSWER);
  }
  return result;
}
