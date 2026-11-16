import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendVerificationEmail, sendResetPasswordEmail } from "@/lib/email";
import { eq } from "drizzle-orm";

export const auth = betterAuth({
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    sendResetPassword: async ({ user, url }) => {
      await sendResetPasswordEmail(user.email, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
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
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      ...schema,
    },
  }),
});
