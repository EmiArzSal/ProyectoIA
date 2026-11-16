import { inngest } from "./client";
import { generateMeetingSummary } from "@/lib/generate-summary";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export const meetingsProcessing = inngest.createFunction(
  {
    id: "meetings/processing",
    retries: 3,
    triggers: [{ event: "meetings/processing" }],
  },
  async ({ event }) => {
    const data = event.data as { meetingId: string; userId: string };

    const [meeting] = await db
      .select()
      .from(meetings)
      .where(and(
        eq(meetings.id, data.meetingId),
        eq(meetings.userId, data.userId),
      ));

    // Account deletion cascades to meetings. Treat queued work for deleted data
    // as completed so Inngest does not retry a job that can never succeed.
    if (!meeting) return { skipped: "meeting_or_account_deleted" };

    await generateMeetingSummary(meeting.id, meeting.transcriptUrl ?? "", data.userId);
  },
);
