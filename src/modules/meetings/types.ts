import { inferRouterOutputs } from "@trpc/server";

import type { AppRouter } from "@/trpc/routers/_app";

export type MeetingGetOne = inferRouterOutputs<AppRouter>["meetings"]["getOne"];
export type MeetingGetMany = inferRouterOutputs<AppRouter>["meetings"]["getMany"]["items"];
export enum MeetingStatus{
    Upcoming ="Upcoming",
    Active = "Active",
    Completed = "Completed",
    Processing = "Processing",
    Failed = "Failed",
}

/** One turn of an interview, as stored (one JSON line each) in meetings.transcript. */
export type TranscriptItem = {
    speaker_id: string;
    type: string;
    text: string;
    start_ts: number;
    stop_ts: number;
}
