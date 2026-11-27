import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendVerificationEmail, sendResetPasswordEmail } from "@/lib/email";
import { eq } from "drizzle-orm";
import { INSTITUTIONAL_EMAIL_MESSAGE, isInstitutionalEmail } from "@/lib/institutional-email";

/** Server-side domain rule (RNF06): the form check alone can be bypassed with a direct API call. */
function assertInstitutionalEmail(email: unknown) {
  if (typeof email !== "string" || !isInstitutionalEmail(email)) {
    throw new APIError("BAD_REQUEST", { message: INSTITUTIONAL_EMAIL_MESSAGE });
  }
}

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.email, url, user.name);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    // The email says the link lasts 24 hours (Better Auth's default is 1 hour).
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url, user.name);
    },
  },
  user: {
    deleteUser: {
      enabled: true,
      afterDelete: async (deletedUser) => {
        try {
          // Better Auth's auth records and app data are removed separately;
          // clear password-reset verification values that are keyed by this user id.
          await db
            .delete(schema.verification)
            .where(eq(schema.verification.value, deletedUser.id));
        } catch {
          // Deletion has already completed. Expiring tokens are harmless, so do not
          // turn a successful account deletion into an apparent failure.
          console.error("[auth] Could not clean up verification values after account deletion.");
        }
      },
    },
  },
  // Every way an account is created or its email changed goes through these hooks.
  databaseHooks: {
    user: {
      create: {
        before: async (user) => {
          assertInstitutionalEmail(user.email);
        },
      },
      update: {
        before: async (data) => {
          if ("email" in data) assertInstitutionalEmail(data.email);
        },
      },
    },
  },
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),
});
