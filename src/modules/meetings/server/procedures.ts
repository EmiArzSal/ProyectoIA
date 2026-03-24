import { db } from "@/db";
import { meetings, user } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/constants";

import { z } from "zod";
import { and, count, desc, eq, getTableColumns, gte, ilike, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { meetingsInsertSchema, meetingsUpdateSchema } from "../schemas";
import { getPredefinedAgent } from "@/lib/predefined-agents";
import { generateAvatarUri } from "@/lib/avatar";
import { MeetingStatus, StreamTranscriptItem } from "../types";
import JSONL from "jsonl-parse-stringify";
import { streamChat } from "@/lib/stream-chat";
import { generateMeetingSummary } from "@/lib/generate-summary";

export const meetingsRouter = createTRPCRouter({
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

  generateChatToken: protectedProcedure.mutation(async ({ctx}) => {
    const token = streamChat.createToken(ctx.auth.user.id);
    await streamChat.upsertUser({
      id: ctx.auth.user.id,
      role: "admin",
    });
    return token;
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
    if(!existingMeeting.transcriptUrl){
      return [];
    }
    let transcriptText: string;
    try {
      if (existingMeeting.transcriptUrl.startsWith("http")) {
        transcriptText = await fetch(existingMeeting.transcriptUrl).then((r) => r.text());
      } else {
        transcriptText = existingMeeting.transcriptUrl;
      }
    } catch {
      return [];
    }
    const transcript = JSONL.parse<StreamTranscriptItem>(transcriptText);
    const speakerIds = [
      ...new Set(transcript.map((item) => item.speaker_id)),
    ];
    
    const userSpeakers = await db
      .select()
      .from(user)
      .where(inArray(user.id, speakerIds))
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
      const [updatedMeeting] = await db
      .update(meetings)
      .set(input)
      .where(
        and(
          eq(meetings.id, input.id),
          eq(meetings.userId, ctx.auth.user.id)
        )
      )
      .returning();

      if(!updatedMeeting) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Entrevista no encontrada",
        });
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
        const [updated] = await db
          .update(meetings)
          .set({ status: "active", startedAt: new Date() })
          .where(and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id)))
          .returning();
        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Entrevista no encontrada" });
        }
        return updated;
      }),

    endMeeting: protectedProcedure
      .input(z.object({ id: z.string(), transcript: z.string() }))
      .mutation(async ({ input, ctx }) => {
        const [updated] = await db
          .update(meetings)
          .set({
            status: "processing",
            endedAt: new Date(),
            transcriptUrl: input.transcript,
          })
          .where(and(eq(meetings.id, input.id), eq(meetings.userId, ctx.auth.user.id)))
          .returning();
        if (!updated) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Entrevista no encontrada" });
        }
        // Fire-and-forget: generates summary in background, no await needed
        void generateMeetingSummary(updated.id, updated.transcriptUrl ?? "", ctx.auth.user.id);

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
        status ? eq(meetings.status, status.toLowerCase() as "upcoming" | "active" | "completed" | "processing" | "cancelled") : undefined,
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
        },
      }));

      return { items, total: total.count, totalPages };
    }),
});

// http://localhost:8288