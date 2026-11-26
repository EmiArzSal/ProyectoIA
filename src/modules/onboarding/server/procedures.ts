import { and, eq, gt } from "drizzle-orm";

import { db } from "@/db";
import { dictionaryEntries, glossaryEntries, interviewUsage, meetings, user } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { buildChecklist } from "@/modules/onboarding/steps";

/** True when the query finds at least one row. */
const exists = async (query: Promise<unknown[]>) => (await query).length > 0;

export const onboardingRouter = createTRPCRouter({
  /** The "Primeros pasos" checklist, derived from what the user has already done. */
  getChecklist: protectedProcedure.query(async ({ ctx }) => {
    const userId = ctx.auth.user.id;
    const [[account], startedInterview, receivedReport, correctionCard, reviewedCard, savedWord] = await Promise.all([
      db.select({ dismissedAt: user.onboardingDismissedAt }).from(user).where(eq(user.id, userId)),
      exists(db.select({ id: interviewUsage.id }).from(interviewUsage)
        .where(eq(interviewUsage.userId, userId)).limit(1)),
      exists(db.select({ id: meetings.id }).from(meetings)
        .where(and(eq(meetings.userId, userId), eq(meetings.status, "completed"))).limit(1)),
      exists(db.select({ id: glossaryEntries.id }).from(glossaryEntries)
        .where(and(eq(glossaryEntries.userId, userId), eq(glossaryEntries.source, "correction"))).limit(1)),
      exists(db.select({ id: glossaryEntries.id }).from(glossaryEntries)
        .where(and(eq(glossaryEntries.userId, userId), gt(glossaryEntries.reviewCount, 0))).limit(1)),
      exists(db.select({ id: dictionaryEntries.id }).from(dictionaryEntries)
        .where(eq(dictionaryEntries.userId, userId)).limit(1)),
    ]);

    return buildChecklist(
      { startedInterview, receivedReport, correctionCard, reviewedCard, savedWord },
      account?.dismissedAt != null,
    );
  }),

  /** Hides the card for good (closed early, or after finishing). */
  dismiss: protectedProcedure.mutation(async ({ ctx }) => {
    await db.update(user).set({ onboardingDismissedAt: new Date() }).where(eq(user.id, ctx.auth.user.id));
  }),
});
