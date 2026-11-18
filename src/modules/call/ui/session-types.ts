import type { SpokenClip } from "@/modules/call/interviewer-script";

export type Phase =
  | "precheck"     // microphone/speaker test; the interview has not started
  | "starting"
  | "ai-thinking"
  | "playing"
  | "user-turn"    // waiting for mic (no timer yet)
  | "recording"    // mic open → timer running
  | "transcribing"
  | "review"       // summary of unanswered questions
  | "interrupted"  // session cannot continue (reload, error) → offer to finish
  | "finishing"    // endMeeting in progress
  | "done";

export type QuestionRecord = {
  agentMessage: string;
  userAnswer: string | null; // null = skipped / no answer
};

// The answer is sent to the server as audio; the server transcribes it and
// writes it to the transcript. mockText is only used in mock mode.
export type UserTurnResult = { audio: Blob | null; skipped: boolean; mockText?: string };

// The interviewer's message and the audio clips it is spoken with, in order.
export type AgentTurn = { text: string; clips: SpokenClip[] };

export type PlayOutcome = "ended" | "error" | "blocked" | "stopped";

export const formatClock = (totalSeconds: number) => {
  const s = Math.max(0, totalSeconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
