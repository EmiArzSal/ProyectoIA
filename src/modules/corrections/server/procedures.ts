import { db } from "@/db";
import { corrections, meetings } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import type { CorrectionType } from "@/db/schema";

export const correctionsRouter = createTRPCRouter({
  getMany: protectedProcedure
    .input(
      z.object({
        type: z.enum(["grammar", "vocabulary", "technical"]).optional(),
      })
    )
    .query(async ({ input, ctx }) => {
      const conditions = [eq(corrections.userId, ctx.auth.user.id)];
      if (input.type) {
        conditions.push(eq(corrections.type, input.type));
      }

      const rows = await db
        .select({
          id: corrections.id,
          original: corrections.original,
          corrected: corrections.corrected,
          type: corrections.type,
          note: corrections.note,
          createdAt: corrections.createdAt,
          meetingId: corrections.meetingId,
          meetingName: meetings.name,
        })
        .from(corrections)
        .leftJoin(meetings, eq(corrections.meetingId, meetings.id))
        .where(and(...conditions))
        .orderBy(desc(corrections.createdAt));

      return rows.map((r) => ({ ...r, type: r.type as CorrectionType }));
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [deleted] = await db
        .delete(corrections)
        .where(
          and(
            eq(corrections.id, input.id),
            eq(corrections.userId, ctx.auth.user.id)
          )
        )
        .returning();
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return deleted;
    }),

  removeAll: protectedProcedure
    .input(
      z.object({
        type: z.enum(["grammar", "vocabulary", "technical"]).optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const conditions = [eq(corrections.userId, ctx.auth.user.id)];
      if (input.type) {
        conditions.push(eq(corrections.type, input.type));
      }
      await db.delete(corrections).where(and(...conditions));
    }),
});
