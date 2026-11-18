import { db } from "@/db";
import { corrections, glossaryEntries } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { z } from "zod";
import { and, asc, count, desc, eq, lte } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { nextReview, normalizeTerm } from "@/modules/glossary/review";

/** Cards per review session (the rest stay due for the next one). */
const REVIEW_BATCH = 30;

const duplicateTerm = (term: string) =>
  new TRPCError({ code: "CONFLICT", message: `Ya tienes «${term}» en tu glosario.` });

export const glossaryRouter = createTRPCRouter({
  getMany: protectedProcedure.query(async ({ ctx }) => {
    return db
      .select()
      .from(glossaryEntries)
      .where(eq(glossaryEntries.userId, ctx.auth.user.id))
      .orderBy(desc(glossaryEntries.createdAt));
  }),

  /** Cards due now, the ones in the lowest boxes (least known) first. */
  getReviewQueue: protectedProcedure.query(async ({ ctx }) => {
    const due = and(eq(glossaryEntries.userId, ctx.auth.user.id), lte(glossaryEntries.dueAt, new Date()));
    const [cards, [total]] = await Promise.all([
      db
        .select()
        .from(glossaryEntries)
        .where(due)
        .orderBy(asc(glossaryEntries.box), asc(glossaryEntries.dueAt), asc(glossaryEntries.id))
        .limit(REVIEW_BATCH),
      db.select({ count: count() }).from(glossaryEntries).where(due),
    ]);
    return { cards, total: total.count };
  }),

  review: protectedProcedure
    .input(z.object({ id: z.string(), grade: z.enum(["again", "hard", "good"]) }))
    .mutation(async ({ input, ctx }) => {
      const scope = and(eq(glossaryEntries.id, input.id), eq(glossaryEntries.userId, ctx.auth.user.id));
      const [card] = await db.select({ box: glossaryEntries.box, reviewCount: glossaryEntries.reviewCount })
        .from(glossaryEntries)
        .where(scope);
      if (!card) throw new TRPCError({ code: "NOT_FOUND" });

      const now = new Date();
      const next = nextReview(card.box, input.grade, now);
      const [updated] = await db
        .update(glossaryEntries)
        .set({ box: next.box, dueAt: next.dueAt, lastReviewedAt: now, reviewCount: card.reviewCount + 1 })
        .where(scope)
        .returning();
      return updated;
    }),

  create: protectedProcedure
    .input(
      z.object({
        term: z.string().trim().min(1).max(200),
        definition: z.string().trim().min(1).max(1000),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const term = normalizeTerm(input.term);
      const [entry] = await db
        .insert(glossaryEntries)
        .values({ userId: ctx.auth.user.id, term, definition: input.definition })
        .onConflictDoNothing()
        .returning();
      if (!entry) throw duplicateTerm(term);
      return entry;
    }),

  /** A correction from an interview report, as a card: what was said → the corrected version. */
  addCorrection: protectedProcedure
    .input(z.object({ correctionId: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const [correction] = await db
        .select()
        .from(corrections)
        .where(and(eq(corrections.id, input.correctionId), eq(corrections.userId, ctx.auth.user.id)));
      if (!correction) throw new TRPCError({ code: "NOT_FOUND", message: "Corrección no encontrada" });

      const term = normalizeTerm(correction.original).slice(0, 200);
      const [entry] = await db
        .insert(glossaryEntries)
        .values({
          userId: ctx.auth.user.id,
          term,
          definition: correction.corrected.slice(0, 1000),
          note: correction.note || null,
          source: "correction",
          correctionId: correction.id,
        })
        .onConflictDoNothing()
        .returning();
      if (!entry) throw duplicateTerm(term);
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
