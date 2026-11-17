import { inngest } from "./client";
import {
  applyRewards,
  markEvaluationFailed,
  prepareEvaluation,
  runEvaluation,
  saveCorrections,
  saveReport,
} from "@/lib/generate-summary";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { MAX_SESSION_MINUTES, MAX_SESSION_MS } from "@/modules/call/constants";

type ProcessingEvent = { meetingId: string; userId: string };

/**
 * Evaluates a finished interview. Each step is retried on its own and its
 * result is memoized, so a failure in a later step never repeats the model
 * call or the rewards. After the last retry, onFailure marks the meeting
 * "failed" and the user can retry it from the report page.
 */
export const meetingsProcessing = inngest.createFunction(
  {
    id: "meetings/processing",
    retries: 3,
    triggers: [{ event: "meetings/processing" }],
    onFailure: async ({ event, error }) => {
      const { meetingId } = event.data.event.data as ProcessingEvent;
      console.error("[meetings/processing] failed after retries", meetingId, error.message);
      await markEvaluationFailed(meetingId);
    },
  },
  async ({ event, step }) => {
    const { meetingId, userId } = event.data as ProcessingEvent;

    const status = await step.run("check-status", async () => {
      const [meeting] = await db
        .select({ status: meetings.status })
        .from(meetings)
        .where(and(eq(meetings.id, meetingId), eq(meetings.userId, userId)));
      return meeting?.status ?? null;
    });

    // Account deletion cascades to meetings: treat queued work for deleted data
    // as done so Inngest does not retry a job that can never succeed.
    if (!status) return { skipped: "meeting_or_account_deleted" };
    // Only meetings in "processing" are evaluated: duplicate events are a no-op.
    if (status !== "processing") return { skipped: `status_${status}` };

    const job = await step.run("prepare", () => prepareEvaluation(meetingId, userId));
    if (job.kind === "gone") return { skipped: "meeting_or_account_deleted" };

    if (job.kind === "static") {
      await step.run("save-report", () => saveReport(meetingId, userId, job.report));
      return { result: "no_answers" };
    }

    const result = await step.run("evaluate", () => runEvaluation(meetingId, userId, job));
    if (!result) return { skipped: "meeting_or_account_deleted" };

    const rewards = await step.run("rewards", () => applyRewards(meetingId, userId, job.agentId, result));
    const correctionCount = await step.run("corrections", () => saveCorrections(meetingId, userId, result.report));
    await step.run("save-report", () => saveReport(meetingId, userId, result.report));

    return { result: "evaluated", rewards, corrections: correctionCount };
  },
);

// Interviews whose tab was closed stay "active". Once they are well past the
// time limit, finish them with whatever was answered and queue the evaluation.
const ABANDONED_GRACE_MS = 5 * 60 * 1000;

export const finalizeAbandonedMeetings = inngest.createFunction(
  {
    id: "meetings/finalize-abandoned",
    retries: 2,
    triggers: [{ cron: "*/15 * * * *" }],
  },
  async ({ step }) => {
    const finalized = await step.run("finalize", async () => {
      const cutoff = new Date(Date.now() - MAX_SESSION_MS - ABANDONED_GRACE_MS);
      return db
        .update(meetings)
        .set({
          status: "processing",
          // The interview could not have lasted longer than the limit.
          endedAt: sql`LEAST(now(), ${meetings.startedAt} + ${sql.raw(`interval '${MAX_SESSION_MINUTES} minutes'`)})`,
          updatedAt: new Date(),
        })
        .where(and(
          eq(meetings.status, "active"),
          isNotNull(meetings.startedAt),
          lt(meetings.startedAt, cutoff),
        ))
        .returning({ meetingId: meetings.id, userId: meetings.userId });
    });

    if (finalized.length > 0) {
      await step.sendEvent(
        "queue-evaluations",
        finalized.map((data) => ({ name: "meetings/processing", data })),
      );
    }
    return { finalized: finalized.length };
  },
);
