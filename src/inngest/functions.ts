import { inngest } from "./client";
import { generateMeetingSummary } from "@/lib/generate-summary";
import { db } from "@/db";
import { meetings } from "@/db/schema";
import { eq } from "drizzle-orm";

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
      .where(eq(meetings.id, data.meetingId));

    if (!meeting) throw new Error(`Meeting ${data.meetingId} not found`);

    await generateMeetingSummary(meeting.id, meeting.transcriptUrl ?? "", data.userId);
  },
);
