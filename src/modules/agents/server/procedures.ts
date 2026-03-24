import { db } from "@/db";
import { meetings } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { PREDEFINED_AGENTS } from "@/lib/predefined-agents";

export const agentsRouter = createTRPCRouter({
  getMany: protectedProcedure.query(async ({ ctx }) => {
    const agentsWithCount = await Promise.all(
      PREDEFINED_AGENTS.map(async (agent) => {
        const [result] = await db
          .select({ count: count() })
          .from(meetings)
          .where(
            and(
              eq(meetings.agentId, agent.id),
              eq(meetings.userId, ctx.auth.user.id)
            )
          );
        return {
          ...agent,
          meetingCount: result.count,
        };
      })
    );
    return agentsWithCount;
  }),

  getOne: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input, ctx }) => {
      const agent = PREDEFINED_AGENTS.find((a) => a.id === input.id);
      if (!agent) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Agente no encontrado",
        });
      }
      const [result] = await db
        .select({ count: count() })
        .from(meetings)
        .where(
          and(
            eq(meetings.agentId, agent.id),
            eq(meetings.userId, ctx.auth.user.id)
          )
        );
      return {
        ...agent,
        meetingCount: result.count,
      };
    }),
});
