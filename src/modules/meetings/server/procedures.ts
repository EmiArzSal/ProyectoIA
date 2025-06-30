import { db } from "@/db";
import { agents, meetings, user } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { DEFAULT_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, MIN_PAGE_SIZE } from "@/constants";

import { z } from "zod";
import { and, count, desc, eq, getTableColumns, ilike, inArray, sql } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { meetingsInsertSchema, meetingsUpdateSchema } from "../schemas";
import { streamVideo } from "@/lib/stream-video";
import { generateAvatarUri } from "@/lib/avatar";
import { MeetingStatus, StreamTranscriptItem } from "../types";
import JSONL from "jsonl-parse-stringify";
import { streamChat } from "@/lib/stream-chat";

export const meetingsRouter = createTRPCRouter({
  getStats: protectedProcedure.query(async ({ctx}) => {
    // Total de sesiones
    const [totalMeetings] = await db
      .select({count: count()})
      .from(meetings)
      .where(eq(meetings.userId, ctx.auth.user.id));

    // Sesiones completadas
    const [completedMeetings] = await db
      .select({count: count()})
      .from(meetings)
      .where(and(
        eq(meetings.userId, ctx.auth.user.id),
        eq(meetings.status, "completed")
      ));

    // Agentes activos (que tienen al menos una sesión)
    const [activeAgents] = await db
      .select({count: count()})
      .from(agents)
      .where(and(
        eq(agents.userId, ctx.auth.user.id),
        sql`EXISTS (
          SELECT 1 FROM ${meetings} 
          WHERE ${meetings.agentId} = ${agents.id}
        )`
      ));

    // Tiempo total (suma de duraciones de sesiones completadas)
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

    // Sesiones esta semana
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const [thisWeekMeetings] = await db
      .select({count: count()})
      .from(meetings)
      .where(and(
        eq(meetings.userId, ctx.auth.user.id),
        sql`created_at >= ${oneWeekAgo}`
      ));

    // Agentes este mes
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    const [thisMonthAgents] = await db
      .select({count: count()})
      .from(agents)
      .where(and(
        eq(agents.userId, ctx.auth.user.id),
        sql`created_at >= ${oneMonthAgo}`
      ));

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
        message: "Sesión no encontrada"
      });
    }
    if(!existingMeeting.transcriptUrl){
      return [];
    }
    const transcript = await fetch(existingMeeting.transcriptUrl)
      .then((res) => res.text())
      .then((text) => JSONL.parse<StreamTranscriptItem>(text))
      .catch(() => {
        return [];
      });
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
    const agentSpeakers = await db
      .select()
      .from(agents)
      .where(inArray(agents.id, speakerIds))
      .then((agents) => {
        return agents.map((agent) => ({
          ...agent,
          image:
            generateAvatarUri({seed: agent.name, variant: "botttsNeutral"})
        }));
      });
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
  generateToken: protectedProcedure.mutation(async ({ctx}) => {
    await streamVideo.upsertUsers(
      [
        {
          id: ctx.auth.user.id,
          name: ctx.auth.user.name,
          role: "admin",
          image:
            ctx.auth.user.image ?? generateAvatarUri({seed: ctx.auth.user.id, variant: "initials"})
        }
      ]
    )
    const expirationTime = Math.floor(Date.now() / 1000) + 3600;
    const issuedAt = Math.floor(Date.now() / 1000) - 60;
    const token = streamVideo.generateUserToken(
      {
        user_id: ctx.auth.user.id,
        exp: expirationTime,
        validity_in_seconds: issuedAt,
      }
    );
    return token;
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
          message: "Sesión no encontrada",
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
          message: "Sesión no encontrada",
        });
      }
      return updatedMeeting;
    }),
      create:protectedProcedure
      .input(meetingsInsertSchema)
      .mutation(async ({ input, ctx }) => {
      const [createdMeeting] = await db
      .insert(meetings)
      .values({
          ...input,
          userId: ctx.auth.user.id, 
      })
      .returning();
      //TODO: Crear las Stream calls

      const call = streamVideo.video.call("default", createdMeeting.id);
      await call.create({
        data: {
          created_by_id: ctx.auth.user.id,
          custom: {
            meetingId: createdMeeting.id,
            meetingName: createdMeeting.name,
          },
          settings_override: {
            transcription: {
              language: "es",
              mode: "auto-on",
              closed_caption_mode: "auto-on",
            },
            recording: {
              mode: "auto-on",
              quality: "1080p",
            },
          },
        },
      })
      const [existingAgent] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, createdMeeting.agentId));

      if(!existingAgent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agente no encontrado",
        });
      }

      await streamVideo.upsertUsers([
        {
          id: existingAgent.id,
          name: existingAgent.name,
          role: "user",
          image: generateAvatarUri({seed: existingAgent.name, variant: "botttsNeutral"})
        }
      ]);
      return createdMeeting;
    }),
    getOne: protectedProcedure
    .input(z.object({id: z.string()}))
    .query(async ({input, ctx}) => {
        const [existingMeeting] = await db
            .select({
              ...getTableColumns(meetings),
              agent: agents,
              duration: sql<number>`EXTRACT(EPOCH FROM (ended_at - started_at))`.as("duration"),
            })
            .from(meetings)
            .innerJoin(agents, eq(meetings.agentId, agents.id))
            .where(
              and(
                eq(meetings.id, input.id),
                eq(meetings.userId, ctx.auth.user.id)
              )
            );

            if(!existingMeeting) {
                throw new TRPCError({
                    code: "NOT_FOUND",
                    message: "Sesión no encontrada",
                });
            }

        return existingMeeting;
      }),

    getMany: protectedProcedure
      .input(
        z.object({
        page: z.number().default(DEFAULT_PAGE),
        pageSize: z
        .number()
        .min(MIN_PAGE_SIZE)
        .max(MAX_PAGE_SIZE)
        .default(DEFAULT_PAGE_SIZE),
        search: z.string().nullish(),
        agentId: z.string().nullish(),
        status: z
          .enum([
              MeetingStatus.Upcoming,
              MeetingStatus.Active,
              MeetingStatus.Completed,
              MeetingStatus.Processing,
              MeetingStatus.Cancelled,
          ])
          .nullish(),
      })
    )
    .query(async ({ ctx, input }) => {
      const { page, pageSize, search, status , agentId } = input;
      
        const data = await db
        .select({
              ...getTableColumns(meetings),
              agent: agents,
              duration: sql<number>`EXTRACT(EPOCH FROM (ended_at - started_at))`.as("duration"),
            })
            .from(meetings)
            .innerJoin(agents, eq(meetings.agentId, agents.id))
            .where(
              and(
                eq(meetings.userId, ctx.auth.user.id),
                search ? ilike(meetings.name, `%${search}%`) : undefined,
                status ? eq(meetings.status, status.toLowerCase() as "upcoming" | "active" | "completed" | "processing" | "cancelled"): undefined,  
                agentId ? eq(meetings.agentId, agentId): undefined,
              )
            )
            .orderBy(desc(meetings.createdAt), desc(meetings.id))
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        const [total] = await db
        .select({count: count()})
        .from(meetings)
        .innerJoin(agents, eq(meetings.agentId, agents.id))
        .where(
          and(
            eq(meetings.userId, ctx.auth.user.id),
            search ? ilike(meetings.name, `%${search}%`) : undefined,
            status ? eq(meetings.status, status.toLowerCase() as "upcoming" | "active" | "completed" | "processing" | "cancelled"): undefined,
            agentId ? eq(meetings.agentId, agentId): undefined,
          )
        );
        const totalPages = Math.ceil(total.count / pageSize);

        return {
          items: data,
          total: total.count,
          totalPages,
        };
      }),
});

// http://localhost:8288