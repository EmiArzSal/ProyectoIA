import "server-only";

import OpenAI from "openai";
import { AI_MODELS, INTERVIEWER_MAX_TOKENS } from "@/lib/ai-models";
import { NO_ANSWER } from "../constants";
import { joinClips, messageClips, type SpokenClip } from "../interviewer-script";
import type { ActiveSession } from "./session";

// The interviewer's message for each turn is composed by code (see
// interviewer-script.ts): [acknowledgment of the last answer] + [transition]
// + [next plan question]. The LLM only writes the one-sentence
// acknowledgment, so it can never skip, repeat, merge or invent questions,
// and the cost per turn stays tiny.

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const CANNED_ACKS = [
  "Thank you for your answer.",
  "Okay, thank you.",
  "Got it, thanks.",
  "Thanks for sharing that.",
];
const SKIPPED_ACKS = [
  "No problem, let's move on.",
  "That's okay, let's continue.",
];

const pick = (list: string[], seed: number) => list[seed % list.length];

/** Keeps the acknowledgment to one short statement; otherwise uses a canned one. */
export function sanitizeAck(text: string | null | undefined, seed: number): string {
  const ack = (text ?? "").trim().replace(/^["'“”]+|["'“”]+$/g, "").replace(/\s+/g, " ");
  if (!ack || ack.length > 160 || ack.includes("?")) return pick(CANNED_ACKS, seed);
  return /[.!]$/.test(ack) ? ack : `${ack}.`;
}

async function acknowledge(session: ActiveSession, question: string, answer: string, seed: number) {
  if (answer === NO_ANSWER) return pick(SKIPPED_ACKS, seed);

  const { agent } = session;
  try {
    const completion = await openai.chat.completions.create(
      {
        model: AI_MODELS.interviewer,
        max_tokens: INTERVIEWER_MAX_TOKENS,
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content:
              `You are ${agent.interviewerName}, a ${agent.role} interviewer in a spoken English job interview for an entry-level position. ` +
              "Reply with ONE short sentence (maximum 20 words) acknowledging the candidate's last answer in a neutral, friendly way. " +
              "Do not evaluate it, do not give the correct answer, do not give hints, and do not ask any question. " +
              "If the answer was not in English, kindly remind them to answer in English. Output only the sentence.",
          },
          { role: "user", content: `Question: ${question}\nCandidate's answer: ${answer.slice(0, 1500)}` },
        ],
      },
      { timeout: 8_000, maxRetries: 0 },
    );
    return sanitizeAck(completion.choices[0]?.message.content, seed);
  } catch (err) {
    console.error("[acknowledge] falling back to canned acknowledgment", err);
    return pick(CANNED_ACKS, seed);
  }
}

export type AgentTurn = { text: string; clips: SpokenClip[] };

/** Builds the interviewer's next message. Callers must check state.canAgentRespond first. */
export async function composeAgentTurn(session: ActiveSession): Promise<AgentTurn> {
  const { agent, plan, items, state } = session;
  const answered = state.userTurns; // questions answered (or skipped) so far
  const questions = plan.map((q) => q.question); // plan is ordered by position

  let ack = "";
  if (answered > 0) {
    const lastAnswer = items.at(-1)?.text ?? NO_ANSWER;
    ack = await acknowledge(session, plan[answered - 1].question, lastAnswer, answered);
  }

  const clips = messageClips(answered, agent, questions, ack);
  return { text: joinClips(clips), clips };
}
