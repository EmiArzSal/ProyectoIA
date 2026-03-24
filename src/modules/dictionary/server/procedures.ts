import { db } from "@/db";
import { dictionaryEntries } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";
import { and, asc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

export const dictionaryRouter = createTRPCRouter({
  getMany: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(dictionaryEntries)
      .where(eq(dictionaryEntries.userId, ctx.auth.user.id))
      .orderBy(asc(dictionaryEntries.letter), asc(dictionaryEntries.word));
  }),

  create: protectedProcedure
    .input(
      z.object({
        word: z.string().min(1).max(200),
        definition: z.string().min(1).max(2000),
        partOfSpeech: z.string().optional(),
        phonetic: z.string().optional(),
        audioUrl: z.string().optional(),
        language: z.enum(["en", "es"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const letter = input.word.trim()[0].toUpperCase();
      const [entry] = await db
        .insert(dictionaryEntries)
        .values({
          userId: ctx.auth.user.id,
          word: input.word.trim(),
          definition: input.definition.trim(),
          partOfSpeech: input.partOfSpeech,
          phonetic: input.phonetic,
          audioUrl: input.audioUrl,
          language: input.language,
          letter,
        })
        .returning();
      return entry;
    }),

  remove: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [deleted] = await db
        .delete(dictionaryEntries)
        .where(
          and(
            eq(dictionaryEntries.id, input.id),
            eq(dictionaryEntries.userId, ctx.auth.user.id)
          )
        )
        .returning();
      if (!deleted) throw new TRPCError({ code: "NOT_FOUND" });
      return deleted;
    }),
});
