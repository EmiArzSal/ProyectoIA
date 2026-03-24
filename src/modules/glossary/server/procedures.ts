import { db } from "@/db";
import { glossaryEntries } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const glossaryRouter = createTRPCRouter({
  getMany: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(glossaryEntries)
      .where(eq(glossaryEntries.userId, ctx.auth.user.id))
      .orderBy(desc(glossaryEntries.createdAt));
  }),

  create: protectedProcedure
    .input(
      z.object({
        term: z.string().min(1).max(200),
        definition: z.string().min(1).max(1000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [entry] = await db
        .insert(glossaryEntries)
        .values({
          userId: ctx.auth.user.id,
          term: input.term.trim(),
          definition: input.definition.trim(),
        })
        .returning();
      return entry;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [deleted] = await db
        .delete(glossaryEntries)
        .where(
          and(
            eq(glossaryEntries.id, input.id),
            eq(glossaryEntries.userId, ctx.auth.user.id)
          )
        )
        .returning();
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return deleted;
    }),
});
