import { and, desc, eq, isNotNull, or, sql } from "drizzle-orm";

import { db } from "@/db";
import { meetingQuestions, meetings, userTopicProgress } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { PREDEFINED_AGENTS, getPredefinedAgent } from "@/lib/predefined-agents";
import { isCefrLevel } from "@/lib/report-columns";
import { summarizeEvolution, type EvolutionPoint } from "@/modules/progress/evolution";
import { SOFT_TOPICS, getTechTopicsForAgent } from "@/lib/interview-topics";

const HISTORY_LENGTH = 5;
/** Interviews shown in "Tu evolución" (the most recent ones). */
const EVOLUTION_LENGTH = 20;

export type TopicStatus = "new" | "weak" | "progress" | "mastered";

export type TopicProgressItem = {
  id: string;
  title: string;
  status: TopicStatus;
  level: number;                 // next level to be asked (1–3)
  attempts: number;
  lastScore: number | null;
  bestScore: number | null;
  lastPracticedAt: string | null;
  /** Oldest → newest; null = question skipped. */
  history: (number | null)[];
};

/**
 * weak: last score 2 or less (it will come back soon).
 * mastered: reached level 3 and scored 4+ there.
 */
function statusOf(row: { level: number; lastScore: number | null } | undefined, isTech: boolean): TopicStatus {
  if (!row || row.lastScore === null) return "new";
  if (row.lastScore <= 2) return "weak";
  if (row.lastScore >= 4 && (!isTech || row.level >= 3)) return "mastered";
  return "progress";
}

export const progressRouter = createTRPCRouter({
  /** English level and scores of the latest evaluated interviews, oldest first. */
  getEvolution: protectedProcedure.query(async ({ ctx }) => {
    const takenAt = sql<Date>`coalesce(${meetings.startedAt}, ${meetings.createdAt})`;
    const rows = await db
      .select({
        id: meetings.id,
        agentId: meetings.agentId,
        takenAt,
        englishLevel: meetings.englishLevel,
        grammar: meetings.grammarScore,
        vocabulary: meetings.vocabularyScore,
        fluency: meetings.fluencyScore,
        technical: meetings.technicalScore,
        softSkills: meetings.softSkillsScore,
      })
      .from(meetings)
      .where(and(
        eq(meetings.userId, ctx.auth.user.id),
        eq(meetings.status, "completed"),
        // Interviews without answers have nothing to plot.
        or(isNotNull(meetings.englishLevel), isNotNull(meetings.technicalScore), isNotNull(meetings.softSkillsScore)),
      ))
      .orderBy(desc(takenAt))
      .limit(EVOLUTION_LENGTH);

    const points: EvolutionPoint[] = rows.reverse().map((r) => ({
      meetingId: r.id,
      date: new Date(r.takenAt).toISOString(),
      role: getPredefinedAgent(r.agentId)?.role ?? "Entrevista",
      englishLevel: isCefrLevel(r.englishLevel) ? r.englishLevel : null,
      scores: {
        grammar: r.grammar,
        vocabulary: r.vocabulary,
        fluency: r.fluency,
        technical: r.technical,
        softSkills: r.softSkills,
      },
    }));

    return { points, summary: summarizeEvolution(points) };
  }),

  getOverview: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.user.id;

    const [rows, scored] = await Promise.all([
      db.select().from(userTopicProgress).where(eq(userTopicProgress.userId, userId)),
      // Scores of evaluated interviews only (pending ones have no score yet).
      db
        .select({ topicId: meetingQuestions.topicId, score: meetingQuestions.score })
        .from(meetingQuestions)
        .innerJoin(meetings, eq(meetings.id, meetingQuestions.meetingId))
        .where(and(eq(meetingQuestions.userId, userId), eq(meetings.status, "completed")))
        .orderBy(desc(meetingQuestions.createdAt))
        .limit(500),
    ]);

    const progress = new Map(rows.map((r) => [r.topicId, r]));
    const history = new Map<string, (number | null)[]>();
    for (const s of scored) {
      const list = history.get(s.topicId) ?? [];
      if (list.length < HISTORY_LENGTH) history.set(s.topicId, [...list, s.score]);
    }

    const toItem = (id: string, title: string, isTech: boolean): TopicProgressItem => {
      const row = progress.get(id);
      return {
        id,
        title,
        status: statusOf(row, isTech),
        level: row?.level ?? 1,
        attempts: row?.attempts ?? 0,
        lastScore: row?.lastScore ?? null,
        bestScore: row?.bestScore ?? null,
        lastPracticedAt: row?.lastPracticedAt?.toISOString() ?? null,
        history: [...(history.get(id) ?? [])].reverse(),
      };
    };

    return {
      roles: PREDEFINED_AGENTS.map((agent) => ({
        agentId: agent.id,
        role: agent.role,
        topics: getTechTopicsForAgent(agent.id).map((t) => toItem(t.id, t.title, true)),
      })),
      softSkills: SOFT_TOPICS.map((t) => toItem(t.id, t.title, false)),
    };
  }),
});
