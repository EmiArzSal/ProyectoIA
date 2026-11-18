import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";

import { db } from "@/db";
import { user } from "@/db/schema";
import { createTRPCRouter, protectedProcedure } from "@/trpc/init";
import { CONSENT_VERSION, hasCurrentConsent } from "@/lib/consent";

/** Whether the user accepted the CURRENT consent version. */
export async function userHasConsent(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ version: user.recordingConsentVersion })
    .from(user)
    .where(eq(user.id, userId));
  return hasCurrentConsent(row?.version);
}

export const consentRouter = createTRPCRouter({
  getStatus: protectedProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select({ version: user.recordingConsentVersion, acceptedAt: user.recordingConsentAt })
      .from(user)
      .where(eq(user.id, ctx.auth.user.id));
    return {
      accepted: hasCurrentConsent(row?.version),
      acceptedAt: row?.acceptedAt ?? null,
      currentVersion: CONSENT_VERSION,
    };
  }),

  // The client sends the version it showed, so an outdated page can never
  // record acceptance of a text the user did not see.
  accept: protectedProcedure
    .input(z.object({ version: z.number().int() }))
    .mutation(async ({ input, ctx }) => {
      if (input.version !== CONSENT_VERSION) {
        throw new TRPCError({ code: "CONFLICT", message: "El aviso cambió. Recarga la página para ver la versión actual." });
      }
      await db
        .update(user)
        .set({ recordingConsentVersion: CONSENT_VERSION, recordingConsentAt: new Date() })
        .where(eq(user.id, ctx.auth.user.id));
      return { accepted: true };
    }),
});
