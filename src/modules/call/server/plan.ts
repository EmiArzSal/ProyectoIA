import "server-only";

import OpenAI from "openai";
import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/db";
import { meetingQuestions, userTopicProgress } from "@/db/schema";
import { AI_MODELS } from "@/lib/ai-models";
import {
  LEVEL_GUIDE,
  SOFT_TOPICS,
  getSoftTopic,
  getTechTopic,
  getTechTopicsForAgent,
  type TopicLevel,
} from "@/lib/interview-topics";
import type { StreamTranscriptItem } from "@/modules/meetings/types";
import { NO_ANSWER, TECH_QUESTIONS, TOTAL_QUESTIONS } from "../constants";
import {
  nextLevel,
  selectSoftTopics,
  selectTechTopics,
  type TopicProgress,
} from "../plan-selection";

export type QuestionKind = "technical" | "soft";

export type PlannedQuestion = {
  position: number;
  kind: QuestionKind;
  topicId: string;
  level: TopicLevel;
  question: string;
  expectedConcepts: string[];
  source: "generated" | "seed";
};

export type StoredQuestion = typeof meetingQuestions.$inferSelect;

const SOFT_QUESTIONS = TOTAL_QUESTIONS - TECH_QUESTIONS;

// ── Building the plan ─────────────────────────────────────────────────────────

/**
 * Chooses 6 technical + 4 soft-skill topics for this user (adaptive, from
 * their topic progress) and writes one question per topic. Never throws for
 * generation problems: any question that fails validation falls back to the
 * topic's seed question.
 */
export async function buildInterviewPlan(
  userId: string,
  agentId: string,
  opts: { generate: boolean },
): Promise<PlannedQuestion[]> {
  const techTopics = getTechTopicsForAgent(agentId);
  if (techTopics.length < TECH_QUESTIONS) {
    throw new Error(`Not enough topics for agent ${agentId}`);
  }

  const topicIds = [...techTopics.map((t) => t.id), ...SOFT_TOPICS.map((t) => t.id)];
  const rows = await db
    .select()
    .from(userTopicProgress)
    .where(and(eq(userTopicProgress.userId, userId), inArray(userTopicProgress.topicId, topicIds)));
  const progress = new Map<string, TopicProgress>(rows.map((r) => [r.topicId, r]));

  const tech = selectTechTopics(techTopics.map((t) => t.id), progress, TECH_QUESTIONS);
  const soft = selectSoftTopics(SOFT_TOPICS.map((t) => t.id), progress, SOFT_QUESTIONS);

  const seedPlan: PlannedQuestion[] = [
    ...tech.map(({ topicId, level }, i) => {
      const topic = getTechTopic(topicId)!;
      return {
        position: i + 1,
        kind: "technical" as const,
        topicId,
        level,
        question: topic.seeds[level - 1],
        expectedConcepts: topic.concepts,
        source: "seed" as const,
      };
    }),
    ...soft.map((topicId, i) => {
      const topic = getSoftTopic(topicId)!;
      return {
        position: TECH_QUESTIONS + i + 1,
        kind: "soft" as const,
        topicId,
        level: 1 as TopicLevel,
        question: topic.seed,
        expectedConcepts: topic.criteria,
        source: "seed" as const,
      };
    }),
  ];

  if (!opts.generate) return seedPlan;

  try {
    const avoid = await recentQuestionsByTopic(userId, seedPlan.map((q) => q.topicId));
    return await generateQuestions(agentId, seedPlan, avoid);
  } catch (err) {
    console.error("[buildInterviewPlan] generation failed, using seed questions", err);
    return seedPlan;
  }
}

/** The user's last two questions per topic, so the generator does not repeat them. */
async function recentQuestionsByTopic(userId: string, topicIds: string[]) {
  const rows = await db
    .select({ topicId: meetingQuestions.topicId, question: meetingQuestions.question })
    .from(meetingQuestions)
    .where(and(eq(meetingQuestions.userId, userId), inArray(meetingQuestions.topicId, topicIds)))
    .orderBy(desc(meetingQuestions.createdAt))
    .limit(60);

  const byTopic = new Map<string, string[]>();
  for (const r of rows) {
    const list = byTopic.get(r.topicId) ?? [];
    if (list.length < 2) byTopic.set(r.topicId, [...list, r.question]);
  }
  return byTopic;
}

const GENERATOR_PROMPT = `
You write questions for a spoken, English-language job interview for ENTRY-LEVEL candidates (junior developers, interns, recent graduates). Many candidates are Spanish speakers practicing English.

For each item you receive, write exactly ONE question:
- About the given topic, at the given difficulty level.
- One single question. Technical items must end with a question mark. Behavioral items may also be one "Tell me about..." sentence ending with a period. No sub-questions, no lists, no "and also".
- At most 35 words, simple and clear English, natural when spoken aloud.
- Answerable verbally in under a minute: never ask to write code, queries or commands character by character.
- Do not include hints or the answer.
- Must be different from any question listed in "avoid".
- Technical items: the question must be answerable using the listed concepts. Return in conceptIndexes the numbers (1-based) of the concepts a good answer to YOUR question should cover (at least 1).
- Behavioral (soft) items: ask about a specific past experience (school, personal projects, work or volunteering are all valid). Return conceptIndexes as an empty array.

Return JSON: {"questions":[{"position":number,"question":string,"conceptIndexes":number[]}]} with one entry per item, same positions.
`.trim();

const generatorOutput = z.object({
  questions: z.array(z.object({
    position: z.number().int(),
    question: z.string(),
    conceptIndexes: z.array(z.number().int()),
  })),
});

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

async function generateQuestions(
  agentId: string,
  seedPlan: PlannedQuestion[],
  avoid: Map<string, string[]>,
): Promise<PlannedQuestion[]> {
  const items = seedPlan.map((q) =>
    q.kind === "technical"
      ? {
          position: q.position,
          kind: "technical",
          topic: getTechTopic(q.topicId)!.title,
          level: q.level,
          levelGuide: LEVEL_GUIDE[q.level],
          concepts: q.expectedConcepts.map((c, i) => `${i + 1}. ${c}`),
          avoid: [...(avoid.get(q.topicId) ?? []), q.question],
        }
      : {
          position: q.position,
          kind: "soft",
          topic: getSoftTopic(q.topicId)!.title,
          criteria: q.expectedConcepts,
          avoid: [...(avoid.get(q.topicId) ?? []), q.question],
        },
  );

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
  const completion = await openai.chat.completions.create(
    {
      model: AI_MODELS.planner,
      temperature: 0.9,
      max_tokens: 1200,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "interview_plan",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["questions"],
            properties: {
              questions: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["position", "question", "conceptIndexes"],
                  properties: {
                    position: { type: "integer" },
                    question: { type: "string" },
                    conceptIndexes: { type: "array", items: { type: "integer" } },
                  },
                },
              },
            },
          },
        },
      },
      messages: [
        { role: "system", content: GENERATOR_PROMPT },
        { role: "user", content: JSON.stringify({ role: agentId, items }) },
      ],
    },
    { timeout: 15_000, maxRetries: 0 },
  );

  const parsed = generatorOutput.parse(JSON.parse(completion.choices[0]?.message.content ?? "{}"));
  const byPosition = new Map(parsed.questions.map((q) => [q.position, q]));

  // Keep generated questions that pass validation; seed the rest.
  return seedPlan.map((seed) => {
    const gen = byPosition.get(seed.position);
    const avoidList = avoid.get(seed.topicId) ?? [];
    if (!gen || !isUsableQuestion(gen.question, avoidList, seed.kind)) return seed;

    if (seed.kind === "soft") {
      return { ...seed, question: gen.question.trim(), source: "generated" as const };
    }

    const n = seed.expectedConcepts.length;
    const idx = [...new Set(gen.conceptIndexes)].filter((i) => i >= 1 && i <= n);
    return {
      ...seed,
      question: gen.question.trim(),
      expectedConcepts: idx.length > 0 ? idx.sort((a, b) => a - b).map((i) => seed.expectedConcepts[i - 1]) : seed.expectedConcepts,
      source: "generated" as const,
    };
  });
}

// ── Persistence ───────────────────────────────────────────────────────────────

/**
 * Stores the plan. If a plan already exists for the meeting (e.g. a retried
 * start), the existing one is kept and returned.
 */
export async function savePlan(meetingId: string, userId: string, plan: PlannedQuestion[]) {
  await db
    .insert(meetingQuestions)
    .values(plan.map((q) => ({ ...q, meetingId, userId })))
    .onConflictDoNothing();
  return loadPlan(meetingId);
}

export function loadPlan(meetingId: string): Promise<StoredQuestion[]> {
  return db
    .select()
    .from(meetingQuestions)
    .where(eq(meetingQuestions.meetingId, meetingId))
    .orderBy(asc(meetingQuestions.position));
}

// ── Answers ───────────────────────────────────────────────────────────────────

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

// ── Progress ──────────────────────────────────────────────────────────────────

/**
 * Saves each question's score and updates the user's topic progress.
 * Unanswered questions keep their level but count as weak (score 1) so the
 * topic comes back soon.
 */
export async function recordPlanResults(
  userId: string,
  plan: StoredQuestion[],
  scores: Map<number, number | null>,
) {
  const now = new Date();

  for (const q of plan) {
    if (!scores.has(q.position)) continue; // the evaluator gave no score
    const score = scores.get(q.position) ?? null;
    const level = q.kind === "technical" ? nextLevel(q.level, score) : 1;
    const effectiveScore = score ?? 1;

    await db
      .update(meetingQuestions)
      .set({ score })
      .where(eq(meetingQuestions.id, q.id));

    await db
      .insert(userTopicProgress)
      .values({
        userId,
        topicId: q.topicId,
        level,
        attempts: 1,
        lastScore: effectiveScore,
        bestScore: score,
        lastPracticedAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [userTopicProgress.userId, userTopicProgress.topicId],
        set: {
          level,
          attempts: sql`${userTopicProgress.attempts} + 1`,
          lastScore: effectiveScore,
          bestScore: score === null
            ? sql`${userTopicProgress.bestScore}`
            : sql`GREATEST(COALESCE(${userTopicProgress.bestScore}, 0), ${score})`,
          lastPracticedAt: now,
          updatedAt: now,
        },
      });
  }
}
