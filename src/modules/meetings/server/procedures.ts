import { db } from "@/db";
import { interviewUsage, meetingQuestions, meetings, user } from "@/db/schema";
import { nanoid } from "nanoid";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/constants";

import { z } from "zod";
import { and, count, desc, eq, getTableColumns, gte, ilike, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { meetingsInsertSchema, meetingsUpdateSchema } from "../schemas";
import { getPredefinedAgent } from "@/lib/predefined-agents";
import { generateAvatarUri } from "@/lib/avatar";
import { MeetingStatus, TranscriptItem } from "../types";
import JSONL from "jsonl-parse-stringify";
import { inngest } from "@/inngest/client";
import { getDailyUsage, MAX_SESSIONS_GLOBAL_PER_DAY } from "@/modules/call/server/limits";
import { userHasConsent } from "@/modules/consent/server/procedures";
import { buildInterviewPlan, savePlan } from "@/modules/call/server/plan";
import { TOTAL_QUESTIONS } from "@/modules/call/constants";

// Mock mode (UI development without API calls) is the only case where the
// client may supply the transcript. Never honoured in production builds.
const ALLOW_CLIENT_MOCK_TRANSCRIPT =
  process.env.NEXT_PUBLIC_SESSION_MOCK === "true" && process.env.NODE_ENV !== "production";

async function assertMeetingExists(id: string, userId: string) {
  const [existing] = await db
    .select({ status: meetings.status })
    .from(meetings)
    .where(and(eq(meetings.id, id), eq(meetings.userId, userId)));
  if (!existing) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Entrevista no encontrada" });
  }
  return existing;
}

export const meetingsRouter = createTRPCRouter({
  getDailyUsage: protectedProcedure.query(({ ctx }) => getDailyUsage(ctx.auth.user.id)),

  getStats: protectedProcedure.query(async ({ctx}) => {
    // Total de entrevistas
    const [totalMeetings] = await db
      .select({count: count()})
      .from(meetings)
      .where(eq(meetings.userId, ctx.auth.user.id));

    // entrevistas completadas
    const [completedMeetings] = await db
      .select({count: count()})
      .from(meetings)
      .where(and(
        eq(meetings.userId, ctx.auth.user.id),
        eq(meetings.status, "completed")
      ));

    // Agentes activos (distintos agentIds con al menos una entrevista )
    const activeAgentsResult = await db
      .selectDistinct({ agentId: meetings.agentId })
      .from(meetings)
      .where(eq(meetings.userId, ctx.auth.user.id));
    const activeAgents = { count: activeAgentsResult.length };

    // Tiempo total (suma de duraciones de entrevistas completadas)
    const [totalTimeResult] = await db
      .select({
        totalSeconds: sql<number>`COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at))), 0)`
      })
      .from(meetings)
      .where(and(
        eq(meetings.userId, ctx.auth.user.id),
        eq(meetings.status, "completed"),
        sql`ended_at IS NOT NULL AND started_at IS NOT NULL`
      ));

    // entrevistas esta semana
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const [thisWeekMeetings] = await db
      .select({count: count()})
      .from(meetings)
      .where(and(
        eq(meetings.userId, ctx.auth.user.id),
        sql`created_at >= ${oneWeekAgo}`
      ));

    // Agentes únicos practicados este mes
    const oneMonthAgoForAgents = new Date();
    oneMonthAgoForAgents.setMonth(oneMonthAgoForAgents.getMonth() - 1);
    const thisMonthAgentsResult = await db
      .selectDistinct({ agentId: meetings.agentId })
      .from(meetings)
      .where(and(
        eq(meetings.userId, ctx.auth.user.id),
        sql`created_at >= ${oneMonthAgoForAgents}`
      ));
    const thisMonthAgents = { count: thisMonthAgentsResult.length };

    // Tiempo esta semana
    const [thisWeekTimeResult] = await db
      .select({
        totalSeconds: sql<number>`COALESCE(SUM(EXTRACT(EPOCH FROM (ended_at - started_at))), 0)`
      })
      .from(meetings)
      .where(and(
        eq(meetings.userId, ctx.auth.user.id),
        eq(meetings.status, "completed"),
        sql`ended_at IS NOT NULL AND started_at IS NOT NULL`,
        sql`created_at >= ${oneWeekAgo}`
      ));

    return {
      totalMeetings: totalMeetings.count,
      completedMeetings: completedMeetings.count,
      activeAgents: activeAgents.count,
      totalTimeSeconds: totalTimeResult.totalSeconds || 0,
      thisWeekMeetings: thisWeekMeetings.count,
      thisMonthAgents: thisMonthAgents.count,
      thisWeekTimeSeconds: thisWeekTimeResult.totalSeconds || 0,
    };
  }),

  getTranscript: protectedProcedure
  .input(z.object({id: z.string()}))
  .query(async ({input, ctx}) => {
    const [existingMeeting] = await db
    .select()
    .from(meetings)
    .where(
      and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id))
    );
    if(!existingMeeting) {
      throw new TRPCError({
        code: "NOT_FOUND", 
        message: "Entrevista no encontrada"
      });
    }
    if(!existingMeeting.transcript){
      return [];
    }
    // The transcript is stored inline as JSONL. Never fetch URLs from this
    // column: it used to be user-controllable, which allowed SSRF.
    const transcriptText = existingMeeting.transcript;
    if (/^https?:\/\//i.test(transcriptText.trim())) {
      return [];
    }
    let transcript: TranscriptItem[];
    try {
      transcript = JSONL.parse<TranscriptItem>(transcriptText);
    } catch {
      return [];
    }
    const speakerIds = [
      ...new Set(transcript.map((item) => item.speaker_id)),
    ];
    
    const userSpeakers = await db
      .select()
      .from(user)
      .where(and(eq(user.id, ctx.auth.user.id), inArray(user.id, speakerIds)))
      .then((users) => {
        return users.map((user) => ({
          ...user,
          image:
            user.image ?? generateAvatarUri({seed: user.name, variant: "initials"})
        }));
      });
    const { PREDEFINED_AGENTS } = await import("@/lib/predefined-agents");
    const agentSpeakers = PREDEFINED_AGENTS
      .filter((agent) => speakerIds.includes(agent.id))
      .map((agent) => ({
        ...agent,
        image: generateAvatarUri({ seed: agent.name, variant: "botttsNeutral" }),
      }));
    const speakers = [...userSpeakers, ...agentSpeakers];
    const transcriptWithSpeakers = transcript.map((item) => {
      const speaker = speakers.find(
        (speaker) => speaker.id === item.speaker_id
      );
      if(!speaker) {
        return {
          ...item,
          user: {
            name: "Desconocido",
            image: generateAvatarUri({seed: "Desconocido", variant: "botttsNeutral"}),
          },
        };
      }
      return {
        ...item,
        user: {
          name: speaker.name,
          image: speaker.image,
        },
      };
    });
    return transcriptWithSpeakers;
  }),

  remove: protectedProcedure
    .input(z.object({id : z.string()}))
    .mutation(async ({input, ctx}) => {
      const [removedMeeting] = await db
      .delete(meetings)
      .where(
        and(
          eq(meetings.id, input.id),
          eq(meetings.userId, ctx.auth.user.id)
        )
      )
      .returning();

      if(!removedMeeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entrevista no encontrada",
        });
      }
      return removedMeeting;
    }),
  update: protectedProcedure
    .input(meetingsUpdateSchema)
    .mutation(async ({input, ctx}) => {
      const [existing] = await db
        .select({ status: meetings.status, agentId: meetings.agentId })
        .from(meetings)
        .where(and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id)));

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Entrevista no encontrada" });
      }

      // The interviewer defines the questions and the evaluation, so it can only
      // change before the interview starts. The name can always be edited.
      const agentChanged = input.agentId !== existing.agentId;
      if (agentChanged) {
        if (existing.status !== "upcoming") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Solo puedes cambiar el entrevistador antes de iniciar la entrevista",
          });
        }
        if (!getPredefinedAgent(input.agentId)) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Agente no encontrado" });
        }
      }

      const [updatedMeeting] = await db
        .update(meetings)
        .set({ name: input.name, agentId: input.agentId, updatedAt: new Date() })
        .where(and(
          eq(meetings.id, input.id),
          eq(meetings.userId, ctx.auth.user.id),
          agentChanged ? eq(meetings.status, "upcoming") : undefined,
        ))
        .returning();

      if (!updatedMeeting) {
        throw new TRPCError({ code: "CONFLICT", message: "La entrevista cambió de estado. Intenta de nuevo." });
      }
      if (agentChanged) {
        // A plan left over from a failed start belongs to the old interviewer.
        await db.delete(meetingQuestions).where(eq(meetingQuestions.meetingId, input.id));
      }
      return updatedMeeting;
    }),
      create: protectedProcedure
      .input(meetingsInsertSchema)
      .mutation(async ({ input, ctx }) => {
        const existingAgent = getPredefinedAgent(input.agentId);
        if (!existingAgent) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Agente no encontrado",
          });
        }

        const [createdMeeting] = await db
          .insert(meetings)
          .values({
            ...input,
            userId: ctx.auth.user.id,
          })
          .returning();

        return createdMeeting;
      }),

    startMeeting: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.auth.user.id;

        // upcoming → active only. Re-entering an active interview must not
        // reset startedAt or the server-side transcript.
        const existing = await assertMeetingExists(input.id, userId);
        if (existing.status !== "upcoming") {
          throw new TRPCError({ code: "CONFLICT", message: "La entrevista ya fue iniciada" });
        }

        // Recording consent is enforced here, not only in the UI: no interview
        // (and no audio sent to the AI provider) without the current version.
        if (!(await userHasConsent(userId))) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Antes de tu primera entrevista debes aceptar el aviso de grabación y privacidad.",
          });
        }

        // Cost guard: per-user and platform-wide daily quotas.
        const usage = await getDailyUsage(userId);
        if (usage.remaining <= 0) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `Ya usaste tus ${usage.limit} entrevistas de hoy. Podrás practicar de nuevo a partir de medianoche.`,
          });
        }
        if (usage.globalExhausted) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: `La plataforma alcanzó su límite de ${MAX_SESSIONS_GLOBAL_PER_DAY} entrevistas por hoy. Intenta mañana.`,
          });
        }

        // Question plan: chosen and written before the interview goes active,
        // so the clock does not run while it is generated. In mock mode the
        // seed questions are used (no OpenAI call).
        const [meeting] = await db
          .select({ agentId: meetings.agentId })
          .from(meetings)
          .where(eq(meetings.id, input.id));
        const plan = await buildInterviewPlan(userId, meeting.agentId, {
          generate: !ALLOW_CLIENT_MOCK_TRANSCRIPT,
        });
        const saved = await savePlan(input.id, userId, plan);
        if (saved.length !== TOTAL_QUESTIONS) {
          throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "No se pudo preparar la entrevista. Intenta de nuevo." });
        }

        // Activation and the quota record in ONE transaction. The usage row is
        // copied from the meeting only if THIS update activated it, so a lost
        // race (another tab) records nothing twice.
        const startedAt = new Date();
        const [activated] = await db.batch([
          db
            .update(meetings)
            .set({ status: "active", startedAt, transcript: null, updatedAt: startedAt })
            .where(and(
              eq(meetings.id, input.id),
              eq(meetings.userId, userId),
              eq(meetings.status, "upcoming"),
            ))
            .returning(),
          db
            .insert(interviewUsage)
            .select(
              db
                .select({
                  id: sql<string>`${nanoid()}::text`.as("id"),
                  userId: meetings.userId,
                  meetingId: meetings.id,
                  startedAt: meetings.startedAt,
                })
                .from(meetings)
                .where(and(
                  eq(meetings.id, input.id),
                  eq(meetings.userId, userId),
                  eq(meetings.status, "active"),
                  eq(meetings.startedAt, startedAt),
                )),
            )
            .onConflictDoNothing(),
        ]);
        const [updated] = activated;
        if (!updated) {
          throw new TRPCError({ code: "CONFLICT", message: "La entrevista ya fue iniciada" });
        }
        return updated;
      }),

    endMeeting: protectedProcedure
      .input(z.object({
        id: z.string(),
        // Only honoured in mock mode (see ALLOW_CLIENT_MOCK_TRANSCRIPT).
        mockTranscript: z.string().max(100_000).optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.auth.user.id;
        const useMockTranscript = ALLOW_CLIENT_MOCK_TRANSCRIPT && input.mockTranscript !== undefined;

        // active → processing only, atomically, so the job is queued once.
        const [updated] = await db
          .update(meetings)
          .set({
            status: "processing",
            endedAt: new Date(),
            updatedAt: new Date(),
            ...(useMockTranscript ? { transcript: input.mockTranscript } : {}),
          })
          .where(and(
            eq(meetings.id, input.id),
            eq(meetings.userId, userId),
            eq(meetings.status, "active"),
          ))
          .returning();

        if (!updated) {
          await assertMeetingExists(input.id, userId);
          throw new TRPCError({ code: "CONFLICT", message: "La entrevista no está en curso" });
        }

        try {
          await inngest.send({
            name: "meetings/processing",
            data: { meetingId: updated.id, userId },
          });
        } catch (err) {
          // Roll back so the user can retry instead of being stuck in "processing".
          await db
            .update(meetings)
            .set({ status: "active", endedAt: null })
            .where(and(eq(meetings.id, updated.id), eq(meetings.status, "processing")));
          console.error("[endMeeting] inngest.send failed", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No se pudo procesar la entrevista. Intenta de nuevo.",
          });
        }

        return updated;
      }),

    // The evaluation ran out of retries (status "failed"): queue it again.
    // Rewards are protected by meetings.rewards_applied_at, so a retry never
    // applies streak, achievements or progress twice.
    retryProcessing: protectedProcedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const userId = ctx.auth.user.id;
        const [updated] = await db
          .update(meetings)
          .set({ status: "processing", updatedAt: new Date() })
          .where(and(
            eq(meetings.id, input.id),
            eq(meetings.userId, userId),
            eq(meetings.status, "failed"),
          ))
          .returning();

        if (!updated) {
          await assertMeetingExists(input.id, userId);
          throw new TRPCError({ code: "CONFLICT", message: "Esta entrevista no tiene una evaluación fallida" });
        }

        try {
          await inngest.send({
            name: "meetings/processing",
            data: { meetingId: updated.id, userId },
          });
        } catch (err) {
          await db
            .update(meetings)
            .set({ status: "failed" })
            .where(and(eq(meetings.id, updated.id), eq(meetings.status, "processing")));
          console.error("[retryProcessing] inngest.send failed", err);
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: "No se pudo reintentar la evaluación. Intenta de nuevo.",
          });
        }

        return updated;
      }),

    getOne: protectedProcedure
    .input(z.object({id: z.string()}))
    .query(async ({input, ctx}) => {
        const [existingMeeting] = await db
            .select({
              ...getTableColumns(meetings),
              duration: sql<number>`EXTRACT(EPOCH FROM (ended_at - started_at))`.as("duration"),
            })
            .from(meetings)
            .where(
              and(
                eq(meetings.id, input.id),
                eq(meetings.userId, ctx.auth.user.id)
              )
            );

            if(!existingMeeting) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Entrevista no encontrada",
                });
            }

        const agent = getPredefinedAgent(existingMeeting.agentId) ?? {
          id: existingMeeting.agentId,
          name: "Entrevistador",
          role: "Entrevistador",
          description: "",
          instructions: "",
          interviewerName: "Entrevistador",
        };

        return { ...existingMeeting, agent };
      }),

    getMany: protectedProcedure
      .input(
        z.object({
        page: z.number().default(DEFAULT_PAGE),
        pageSize: z.number().min(MIN_PAGE_SIZE).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
        search: z.string().nullish(),
        agentId: z.string().nullish(),
        status: z.enum([
          MeetingStatus.Upcoming,
          MeetingStatus.Active,
          MeetingStatus.Completed,
          MeetingStatus.Processing,
          MeetingStatus.Cancelled,
          MeetingStatus.Failed,
        ]).nullish(),
        period: z.enum(["week", "month", "quarter"]).nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, status, agentId, period } = input;

      let fromDate: Date | undefined;
      if (period === "week") {
        fromDate = new Date();
        fromDate.setDate(fromDate.getDate() - 7);
      } else if (period === "month") {
        fromDate = new Date();
        fromDate.setMonth(fromDate.getMonth() - 1);
      } else if (period === "quarter") {
        fromDate = new Date();
        fromDate.setMonth(fromDate.getMonth() - 3);
      }

      const whereConditions = and(
        eq(meetings.userId, ctx.auth.user.id),
        search ? ilike(meetings.name, `%${search}%`) : undefined,
        status ? eq(meetings.status, status.toLowerCase() as "upcoming" | "active" | "completed" | "processing" | "cancelled" | "failed") : undefined,
        agentId ? eq(meetings.agentId, agentId) : undefined,
        fromDate ? gte(meetings.createdAt, fromDate) : undefined,
      );

      const data = await db
        .select({
          ...getTableColumns(meetings),
          duration: sql<number>`EXTRACT(EPOCH FROM (ended_at - started_at))`.as("duration"),
        })
        .from(meetings)
        .where(whereConditions)
        .orderBy(desc(meetings.createdAt), desc(meetings.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);

      const [total] = await db
        .select({ count: count() })
        .from(meetings)
        .where(whereConditions);

      const totalPages = Math.ceil(total.count / pageSize);

      const items = data.map((meeting) => ({
        ...meeting,
        agent: getPredefinedAgent(meeting.agentId) ?? {
          id: meeting.agentId,
          name: "Entrevistador",
          role: "Entrevistador",
          description: "",
          instructions: "",
          interviewerName: "Entrevistador",
        },
      }));

      return { items, total: total.count, totalPages };
    }),
});

// http://localhost:8288