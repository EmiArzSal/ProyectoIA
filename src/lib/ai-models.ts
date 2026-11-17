// Single place to choose the OpenAI models. Cheap models handle the
// high-volume parts of the interview; the stronger one is used only once,
// for the final evaluation, where quality matters most.

export const AI_MODELS = {
  /** Short acknowledgment of each answer (≤10 tiny calls per interview). */
  interviewer: "gpt-4o-mini",
  /** Writes the 10 questions of the plan (1 call per interview). */
  planner: "gpt-4o-mini",
  /** Interviewer voice. */
  tts: "gpt-4o-mini-tts",
  /** Candidate answers. */
  transcription: "gpt-4o-mini-transcribe",
  /** Final report (1 call per interview). */
  evaluation: "gpt-4o",
} as const;

export const TTS_VOICE = "alloy";

// gpt-4o-mini-tts accepts style instructions. A slightly slower pace helps
// candidates whose first language is Spanish.
export const TTS_INSTRUCTIONS =
  "Speak as a calm, friendly, professional job interviewer. Use clear American English at a slightly slower than normal pace.";

/** Upper bound for each interviewer acknowledgment (one short sentence). */
export const INTERVIEWER_MAX_TOKENS = 60;
