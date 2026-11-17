// Shared between the call UI and the server-side session logic so both agree
// on the interview structure.

export const TOTAL_QUESTIONS = 10;
export const TECH_QUESTIONS = 6;   // questions 1–6 are technical
export const TECH_TIMER_S = 45;
export const SOFT_TIMER_S = 60;    // questions 7–10 are soft skills

// Hard limit for the whole interview, enforced by the server from startedAt.
// Target is 10 minutes; the extra 2 cover model and audio latency.
export const MAX_SESSION_MINUTES = 12;
export const MAX_SESSION_MS = MAX_SESSION_MINUTES * 60 * 1000;

// Literal stored in the transcript when the candidate skipped or said nothing.
// generate-summary.ts and award-achievements.ts rely on this exact value.
export const NO_ANSWER = "(sin respuesta)";
