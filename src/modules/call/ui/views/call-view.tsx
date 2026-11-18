"use client";

import { useState, useRef, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery, useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { GeneratedAvatar } from "@/components/ui/generated-avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MicIcon,
  LoaderIcon,
  PhoneOffIcon,
  SkipForwardIcon,
  CheckIcon,
  TriangleAlertIcon,
  ArrowLeftIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { ErrorState } from "@/components/error-state";
import {
  MAX_SESSION_MINUTES,
  MAX_SESSION_MS,
  NO_ANSWER,
  SOFT_TIMER_S,
  TECH_QUESTIONS,
  TECH_TIMER_S,
  TOTAL_QUESTIONS,
} from "@/modules/call/constants";
import { MicCheck } from "@/modules/call/ui/components/mic-check";
import { CONSENT_VERSION } from "@/lib/consent";
import { CLOSING_AUDIO_URL, introAudioUrl, type Clip } from "@/modules/call/interviewer-script";
import {
  MIC_ERROR_MESSAGES,
  pickRecorderMimeType,
  useMicrophone,
} from "@/modules/call/ui/hooks/use-microphone";

// ── Mock mode (set NEXT_PUBLIC_SESSION_MOCK=true in .env.local) ────────────────
// Zero API calls — use fake responses and short timers for UI development testing.

const IS_MOCK = process.env.NEXT_PUBLIC_SESSION_MOCK === "true";
const MOCK_TIMER_S = 5;

const MOCK_AGENT_RESPONSES = [
  "Hello! I'm Alex, your interviewer today. We'll go through some technical and behavioral questions. Let's start — can you explain what the virtual DOM is and why React uses it?",
  "Good. Next: what's the difference between useState and useReducer in React, and when would you choose one over the other?",
  "Nice. Can you explain what a JavaScript closure is and give a practical example?",
  "Got it. What's the difference between Flexbox and CSS Grid, and when do you use each?",
  "Good answer. Can you explain what async/await is and how it relates to Promises?",
  "Alright. What does the term 'semantic HTML' mean, and why does it matter for accessibility?",
  "Let's switch to behavioral questions. Tell me about a personal or academic project you're proud of.",
  "That's great. Describe a time you had to learn a new technology quickly — how did you approach it?",
  "Good. How do you prioritize tasks when working under a deadline?",
  "Last question: describe a challenging bug you encountered. How did you debug and fix it?",
  "Thank you! That concludes our interview. You demonstrated solid knowledge across frontend fundamentals and gave thoughtful answers to the behavioral questions. Good luck!",
];

const MOCK_USER_ANSWERS = [
  "Mmm, the virtual DOM is like a copy of the real DOM but in memory. React use it to, how to say, compare changes and then update only the parts that changed. Is more fast than change everything.",
  "I think useState is for when you have simple things to save, like a number or a text. useReducer is for when the logic is more complicated, like when you have many things that change together. I use useState most of times.",
  "A closure is... when a function can remember variables from outside, even when the outside function already finished. For example if you have a function that returns another function, the inside one still can use the variables.",
  "Flexbox is for put things in one line, like a row or a column. Grid is when you need rows and columns at same time, like a table but more flexible. I use flexbox more because is more easy for me.",
  "Async await is like a way to work with promises but more easy to read. Instead of write many dot then, you just put await and the code wait until the promise finish. I think is same thing but different syntax.",
  "Semantic HTML is use the correct tags for each thing. Like, use header for the header and nav for navigation instead of use div for everything. Is good because help the browser understand the page better.",
  "Yes, I make a web app for manage tasks in my university. We use React in the front and a simple API in the back. I was in charge of the interface and I learned a lot about how to organize the components.",
  "In my last semester I need to learn a framework very fast for a project. I watched some videos and read the documentation and then I just start coding. I make errors but I learn from them and finish the project.",
  "I try to organize my tasks by which is more important and which need to be done first. If I have too many things I talk with my team to see if someone can help. I also write lists to not forget anything.",
  "One time I have a bug where a component was rendering infinite times. I was confuse for a long time. Then I ask a friend and he tell me the problem was in the dependency array of useEffect. I was passing an object and it change every render.",
];

// ── Types ──────────────────────────────────────────────────────────────────────

type Phase =
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

type TranscriptItem = {
  speaker_id: string;
  type: string;
  text: string;
  start_ts: number;
  stop_ts: number;
};

type QuestionRecord = {
  agentMessage: string;
  userAnswer: string | null; // null = skipped / no answer
};

// The answer is sent to the server as audio; the server transcribes it and
// writes it to the transcript. mockText is only used in mock mode.
type UserTurnResult = { audio: Blob | null; skipped: boolean; mockText?: string };

// The interviewer's message and the audio clips it is spoken with, in order.
type AgentTurn = { text: string; clips: Clip[] };

type PlayOutcome = "ended" | "error" | "blocked" | "stopped";

const trpcErrorCode = (err: unknown) =>
  err instanceof TRPCClientError ? (err.data as { code?: string } | undefined)?.code : undefined;

// The server answered 410: the interview's time limit has passed.
class TimeUpError extends Error {}

const formatClock = (totalSeconds: number) => {
  const s = Math.max(0, totalSeconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

// Local file: testing the speakers costs no API call.
const TEST_SOUND_URL = "/sounds/mic-check.mp3";

const readApiError = async (res: Response, fallback: string) => {
  try {
    const data = await res.json();
    return typeof data?.error === "string" ? data.error : fallback;
  } catch {
    return fallback;
  }
};

// ── Component ─────────────────────────────────────────────────────────────────

interface Props { meetingId: string }

export const CallView = ({ meetingId }: Props) => {
  const trpc         = useTRPC();
  const router       = useRouter();
  const queryClient  = useQueryClient();
  const { data: sessionData } = authClient.useSession();

  const { data: meeting } = useSuspenseQuery(
    trpc.meetings.getOne.queryOptions({ id: meetingId })
  );

  // Status when the page loaded. The live query is invalidated while finishing,
  // so decisions about whether to run the session use this snapshot.
  const initialStatusRef = useRef(meeting.status);

  // ── State ────────────────────────────────────────────────────────────────────

  // An interview that has not started opens on the equipment check; the
  // interview (and the daily quota) starts only from its button.
  const initialPhase: Phase = initialStatusRef.current === "upcoming" ? "precheck" : "starting";
  const [phase, setPhaseState]         = useState<Phase>(initialPhase);
  const [currentText, setCurrentText]  = useState("");
  const currentTextRef                 = useRef("");
  const [secondsLeft, setSecondsLeft]  = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [unanswered, setUnanswered]    = useState<QuestionRecord[]>([]);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number | null>(null);

  // ── Refs ─────────────────────────────────────────────────────────────────────

  const phaseRef        = useRef<Phase>(initialPhase);
  const sessionStartRef = useRef(0);
  const transcriptRef   = useRef<TranscriptItem[]>([]); // mock mode only

  const mic = useMicrophone({ monitorLevel: phase === "precheck" });

  // Recording consent (enforced again by startMeeting on the server).
  const consentQuery = useQuery({
    ...trpc.consent.getStatus.queryOptions(),
    enabled: initialStatusRef.current === "upcoming",
  });
  const acceptConsent = useMutation(trpc.consent.accept.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries(trpc.consent.getStatus.queryOptions()),
    onError: (err) => toast.error(err.message),
  }));

  // One audio element for the whole interview. It is first played inside a
  // click (speaker test or "Iniciar entrevista"), which unlocks it for the
  // interviewer's voice in browsers with strict autoplay rules (Safari).
  const audioElRef        = useRef<HTMLAudioElement | null>(null);
  const audioWarnedRef    = useRef(false);
  // Audio of plan questions, fetched while the candidate answers the previous one.
  const questionAudioRef  = useRef(new Map<number, Promise<string | null>>());
  const objectUrlsRef     = useRef<string[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer seconds for the currently active question
  const currentTimerRef  = useRef(TECH_TIMER_S);

  // Promise resolvers
  const userTurnResolveRef     = useRef<((r: UserTurnResult) => void) | null>(null);
  const reviewDecisionResolveRef = useRef<((d: "answer" | "finish") => void) | null>(null);

  // Skip flag: set before stopping MediaRecorder so onstop knows not to send audio
  const skipRecordingRef = useRef(false);

  // Set to true when finishSession is called — stops the async loop cleanly
  const isStoppingRef = useRef(false);

  // Whole-interview clock (the server enforces the same limit).
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeUpRef       = useRef(false);

  // Lifecycle guards. The session loop must run exactly once per page load
  // (startMeeting is not repeatable); mountedRef survives React StrictMode's
  // simulated unmount/remount in development.
  const mountedRef    = useRef(false);
  const runStartedRef = useRef(false);

  // Mock mode counters
  const mockResponseIdxRef = useRef(0);
  const mockAnswerIdxRef   = useRef(0);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  const shouldStop = () => !mountedRef.current || isStoppingRef.current;

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const clearSessionClock = () => {
    if (sessionTimerRef.current) { clearInterval(sessionTimerRef.current); sessionTimerRef.current = null; }
  };

  // In real sessions the server builds the transcript; this is only for mock mode.
  const addMockTranscript = (speakerId: string, text: string) => {
    if (!IS_MOCK) return;
    const now = Date.now() - sessionStartRef.current;
    transcriptRef.current.push({ speaker_id: speakerId, type: "text", text, start_ts: now, stop_ts: now + 500 });
  };

  const getAudioEl = () => (audioElRef.current ??= new Audio());

  // Resolves the playback in progress, so stopAudio can end it.
  const playbackResolveRef = useRef<((outcome: PlayOutcome) => void) | null>(null);

  /** Plays `url` to the end. Resolves "blocked" if the browser refused to play. */
  const playUrl = (url: string) =>
    new Promise<PlayOutcome>((resolve) => {
      playbackResolveRef.current?.("stopped"); // a new clip replaces the previous one
      playbackResolveRef.current = resolve;
      const audio = getAudioEl();
      audio.muted = false;
      audio.onended = () => resolve("ended");
      audio.onerror = () => resolve("error");
      audio.src = url;
      audio.play().catch((err: unknown) =>
        resolve(err instanceof DOMException && err.name === "NotAllowedError" ? "blocked" : "error"));
    });

  const playTestSound = async () => (await playUrl(TEST_SOUND_URL)) === "ended";

  /** Silences the interviewer; the playback in progress resolves "stopped". */
  const stopAudio = () => {
    const audio = audioElRef.current;
    if (audio) {
      audio.onended = null;
      audio.onerror = null;
      audio.pause();
    }
    playbackResolveRef.current?.("stopped");
    playbackResolveRef.current = null;
  };

  const warnAudioBlocked = () => {
    if (audioWarnedRef.current) return;
    audioWarnedRef.current = true;
    toast.warning("Tu navegador bloqueó el audio del entrevistador. Puedes leer las preguntas en pantalla.");
  };

  // Mock mode, inside the "Iniciar entrevista" click: a muted play unlocks the
  // element. Real interviews unlock it by playing the greeting in that click.
  const unlockAudio = () => {
    const audio = getAudioEl();
    audio.muted = true;
    audio.src = TEST_SOUND_URL;
    audio.play().then(() => audio.pause(), () => {}).finally(() => { audio.muted = false; });
  };

  /** Generates one clip on the server. Null on failure: the text stays on screen. */
  const fetchSpeech = async (body: { part: Clip["kind"]; index?: number }): Promise<string | null> => {
    try {
      const res = await fetch("/api/session/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, ...body }),
      });
      if (!res.ok) return null;
      const url = URL.createObjectURL(await res.blob());
      objectUrlsRef.current.push(url);
      return url;
    } catch {
      return null;
    }
  };

  /** Starts fetching a question's audio so it is ready when it is asked. */
  const prefetchQuestion = (index: number) => {
    if (IS_MOCK || index < 0 || index >= TOTAL_QUESTIONS) return;
    const cache = questionAudioRef.current;
    if (!cache.has(index)) cache.set(index, fetchSpeech({ part: "question", index }));
  };

  const questionAudio = async (index: number) => {
    const prefetched = await questionAudioRef.current.get(index);
    return prefetched ?? fetchSpeech({ part: "question", index });
  };

  const clipSource = (clip: Clip): Promise<string | null> => {
    switch (clip.kind) {
      case "intro":    return Promise.resolve(introAudioUrl(meeting.agent.id));
      case "closing":  return Promise.resolve(CLOSING_AUDIO_URL);
      case "ack":      return fetchSpeech({ part: "ack" });
      case "question": return questionAudio(clip.index);
    }
  };

  // Speaks the interviewer's message clip by clip. Every clip starts loading
  // at once (the question is usually prefetched already), so the next one is
  // ready when the previous ends.
  const playAgentTurn = async (turn: AgentTurn): Promise<void> => {
    if (IS_MOCK) {
      await new Promise<void>((r) => setTimeout(r, 300));
      return;
    }
    const sources = turn.clips.map((clip) => ({ clip, url: clipSource(clip) }));
    for (const { clip, url } of sources) {
      if (shouldStop()) return;
      const src = await url;
      let outcome = src ? await playUrl(src) : "error";
      // A pre-recorded file that is missing: generate it instead.
      if (outcome === "error" && (clip.kind === "intro" || clip.kind === "closing")) {
        const generated = await fetchSpeech({ part: clip.kind });
        if (generated && !shouldStop()) outcome = await playUrl(generated);
      }
      if (outcome === "stopped") return;
      if (outcome === "blocked") {
        warnAudioBlocked();
        return;
      }
    }
  };

  // The server decides the prompt and progress from its own transcript.
  const getAgentResponse = async (): Promise<AgentTurn> => {
    if (IS_MOCK) {
      await new Promise<void>((r) => setTimeout(r, 400));
      const idx = mockResponseIdxRef.current++;
      return { text: MOCK_AGENT_RESPONSES[Math.min(idx, MOCK_AGENT_RESPONSES.length - 1)], clips: [] };
    }

    const res = await fetch("/api/session/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingId }),
    });
    if (res.status === 410) throw new TimeUpError();
    if (!res.ok) throw new Error(await readApiError(res, "Error al obtener respuesta del agente"));
    return await res.json() as AgentTurn;
  };

  // Sends the answer (or a skip) to the server, which transcribes and records
  // it and, in the main round, already returns the interviewer's next message.
  const submitAnswer = async (result: UserTurnResult): Promise<{ text: string; agent: AgentTurn | null }> => {
    if (IS_MOCK) return { text: result.skipped ? "" : (result.mockText ?? ""), agent: null };

    const formData = new FormData();
    formData.append("meetingId", meetingId);
    if (!result.skipped && result.audio && result.audio.size > 0) {
      formData.append("audio", result.audio, "answer");
    }

    const res = await fetch("/api/session/transcribe", { method: "POST", body: formData });
    if (res.status === 410) throw new TimeUpError();
    if (!res.ok) throw new Error(await readApiError(res, "No se pudo registrar tu respuesta"));

    const data = await res.json() as { text?: string; transcriptionFailed?: boolean; agent?: AgentTurn | null };
    if (data.transcriptionFailed) {
      toast.error("No pudimos transcribir tu respuesta; se registró como sin respuesta.");
    }
    return { text: data.text ?? "", agent: data.agent ?? null };
  };

  // ── Timer (starts when mic opens) ─────────────────────────────────────────────

  const startCountdown = () => {
    let remaining = currentTimerRef.current;
    setSecondsLeft(remaining);

    timerRef.current = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        clearTimer();
        // Auto-stop recording when time runs out
        if (phaseRef.current === "recording") {
          mediaRecorderRef.current?.stop();
        }
      }
    }, 1000);
  };

  // ── Whole-interview clock ─────────────────────────────────────────────────────

  // Called when the interview's total time runs out. An answer being recorded
  // is still sent (the server allows a grace period); then the session ends.
  const handleTimeUp = () => {
    if (timeUpRef.current || isStoppingRef.current) return;
    timeUpRef.current = true;
    clearSessionClock();
    toast.info("Se acabó el tiempo de la entrevista. Finalizando...");

    if (phaseRef.current === "recording") {
      clearTimer();
      mediaRecorderRef.current?.stop(); // loop submits the answer, then finishes
      return;
    }
    if (phaseRef.current === "transcribing") return; // loop finishes after submit
    void finishSession();
  };

  const startSessionClock = () => {
    // A few seconds early so the client never runs past the server's limit.
    const deadline = Date.now() + MAX_SESSION_MS - 5000;
    const tick = () => {
      const left = Math.ceil((deadline - Date.now()) / 1000);
      setSessionSecondsLeft(Math.max(0, left));
      if (left <= 0) handleTimeUp();
    };
    tick();
    sessionTimerRef.current = setInterval(tick, 1000);
  };

  // ── User-turn promise ─────────────────────────────────────────────────────────

  // Returns a promise that resolves once the user submits, skips, or timer expires
  const waitForUserTurn = (): Promise<UserTurnResult> =>
    new Promise((resolve) => { userTurnResolveRef.current = resolve; });

  const resolveUserTurn = (result: UserTurnResult) => {
    const r = userTurnResolveRef.current;
    userTurnResolveRef.current = null;
    r?.(result);
  };

  // ── Review-decision promise ───────────────────────────────────────────────────

  const waitForReviewDecision = (): Promise<"answer" | "finish"> =>
    new Promise((resolve) => { reviewDecisionResolveRef.current = resolve; });

  // ── PTT handlers ─────────────────────────────────────────────────────────────

  const handleStartRecording = async () => {
    if (phaseRef.current !== "user-turn") return;

    // ── Mock: auto-answer after 1.5 s, no mic needed ──────────────────────────
    if (IS_MOCK) {
      setPhase("recording");
      startCountdown();
      setTimeout(() => {
        if (isStoppingRef.current) return;
        clearTimer();
        const answer = MOCK_USER_ANSWERS[mockAnswerIdxRef.current % MOCK_USER_ANSWERS.length];
        mockAnswerIdxRef.current++;
        resolveUserTurn({ audio: null, skipped: false, mockText: answer });
      }, 1500);
      return;
    }

    const stream = await mic.getStream();
    if (!stream) {
      toast.error("No se pudo acceder al micrófono. Usa \"Reconectar micrófono\" e inténtalo de nuevo.");
      return;
    }
    // The turn may have ended (skip, time up) while the microphone reopened.
    if (phaseRef.current !== "user-turn") return;

    let recorder: MediaRecorder;
    try {
      recorder = createRecorder(stream);
    } catch {
      // Some browsers (Safari) refuse a new recorder on a reused stream: reopen once.
      const fresh = await mic.acquire();
      try {
        if (!fresh || phaseRef.current !== "user-turn") throw new Error("no stream");
        recorder = createRecorder(fresh);
      } catch {
        toast.error("No se pudo grabar con tu micrófono. Usa \"Reconectar micrófono\" e inténtalo de nuevo.");
        return;
      }
    }

    mediaRecorderRef.current = recorder;
    setPhase("recording");
    startCountdown(); // ← timer starts here, when recording starts
  };

  // A new recorder per answer over the interview's single microphone stream.
  const createRecorder = (stream: MediaStream) => {
    audioChunksRef.current = [];
    const mimeType = pickRecorderMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = () => {
      clearTimer();

      // Skip path: don't send audio, just resolve as skipped
      if (skipRecordingRef.current) {
        skipRecordingRef.current = false;
        resolveUserTurn({ audio: null, skipped: true });
        return;
      }

      if (isStoppingRef.current || phaseRef.current === "done") return;

      // Use the recorder's real MIME type (Safari records audio/mp4, not webm).
      const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
      resolveUserTurn({ audio: blob, skipped: false });
    };

    recorder.start();
    return recorder;
  };

  const handleStopRecording = () => {
    if (phaseRef.current !== "recording") return;
    clearTimer();
    mediaRecorderRef.current?.stop();
  };

  const handleSkipQuestion = () => {
    clearTimer();
    if (phaseRef.current === "recording") {
      skipRecordingRef.current = true;
      mediaRecorderRef.current?.stop();
    } else if (phaseRef.current === "user-turn") {
      resolveUserTurn({ audio: null, skipped: true });
    }
  };

  // ── Finalize ─────────────────────────────────────────────────────────────────

  const endMeeting = useMutation(trpc.meetings.endMeeting.mutationOptions());

  const finishSession = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    setPhase("finishing");
    clearTimer();
    clearSessionClock();
    stopAudio();

    // Resolve any pending promises so the async loop can exit
    resolveUserTurn({ audio: null, skipped: true });
    reviewDecisionResolveRef.current?.("finish");
    reviewDecisionResolveRef.current = null;

    // Stop mic if still active
    if (mediaRecorderRef.current?.state === "recording") {
      skipRecordingRef.current = true;
      mediaRecorderRef.current.stop();
      await new Promise<void>((r) => setTimeout(r, 300));
    }
    mic.release();

    const mockTranscript = IS_MOCK
      ? transcriptRef.current.map((item) => JSON.stringify(item)).join("\n")
      : undefined;

    try {
      await endMeeting.mutateAsync({ id: meetingId, mockTranscript });
      await queryClient.invalidateQueries(trpc.meetings.getOne.queryOptions({ id: meetingId }));
      setPhase("done");
      toast.success("Entrevista finalizada. Generando resumen...");
      router.push(`/meetings/${meetingId}`);
    } catch (err) {
      // Already finished (e.g. another tab) — just show the result page.
      if (trpcErrorCode(err) === "CONFLICT") {
        router.push(`/meetings/${meetingId}`);
        return;
      }
      console.error("[finishSession]", err);
      toast.error("Error al finalizar la entrevista. Intenta de nuevo.");
      isStoppingRef.current = false;
      setPhase("interrupted");
    }
  };

  // ── Main session runner ───────────────────────────────────────────────────────

  const startMeeting = useMutation(trpc.meetings.startMeeting.mutationOptions());

  // `greeting` is the pre-recorded greeting, already playing since the click
  // (null in mock mode). It covers the time startMeeting takes to write the
  // question plan.
  const runSession = async (greeting: Promise<PlayOutcome> | null) => {
    try {
      // 1. Activate meeting (server allows this only once: upcoming → active)
      try {
        await startMeeting.mutateAsync({ id: meetingId });
      } catch (err) {
        stopAudio();
        const code = trpcErrorCode(err);
        if (code === "CONFLICT") { setPhase("interrupted"); return; }
        if (code === "PRECONDITION_FAILED") {
          // Consent missing or outdated: back to the check, which asks for it.
          toast.error((err as Error).message);
          runStartedRef.current = false;
          await queryClient.invalidateQueries(trpc.consent.getStatus.queryOptions());
          setPhase("precheck");
          return;
        }
        if (code === "TOO_MANY_REQUESTS") {
          toast.error((err as Error).message);
          router.push(`/meetings/${meetingId}`);
          return;
        }
        throw err;
      }
      void queryClient.invalidateQueries(trpc.meetings.getDailyUsage.queryOptions());
      if (shouldStop()) return;
      sessionStartRef.current = Date.now();
      if (!IS_MOCK) startSessionClock();
      prefetchQuestion(0); // the plan exists now; ready by the end of the greeting

      // 2. Initial greeting + first question (the phase stays "starting":
      // the intro text needs no model call and arrives right away)
      const intro = await getAgentResponse();
      if (shouldStop()) return;

      addMockTranscript(meeting.agent.id, intro.text);
      currentTextRef.current = intro.text;
      setCurrentText(intro.text);

      setPhase("playing");
      let greeted = greeting ? await greeting : "ended";
      if (greeted === "error" && !shouldStop()) {
        // The pre-recorded file is missing: generate the greeting instead.
        const generated = await fetchSpeech({ part: "intro" });
        if (generated && !shouldStop()) greeted = await playUrl(generated);
      }
      if (shouldStop()) return;
      if (greeted === "blocked") warnAudioBlocked();
      else await playAgentTurn({ ...intro, clips: intro.clips.filter((c) => c.kind !== "intro") });
      if (shouldStop()) return;

      // 3. 10-question loop
      const records: QuestionRecord[] = [];

      for (let i = 0; i < TOTAL_QUESTIONS; i++) {
        if (shouldStop()) return;

        currentTimerRef.current = IS_MOCK ? MOCK_TIMER_S : (i < TECH_QUESTIONS ? TECH_TIMER_S : SOFT_TIMER_S);
        setQuestionIndex(i);
        // Capture the current question text for the record
        const agentQuestion = currentTextRef.current;
        prefetchQuestion(i + 1); // asked after this answer
        setPhase("user-turn");

        const result = await waitForUserTurn();
        if (shouldStop()) return;

        setPhase("transcribing");
        const submitted = await submitAnswer(result);
        if (shouldStop()) return;
        if (timeUpRef.current) { await finishSession(); return; }

        const { text } = submitted;
        const answered = !result.skipped && text.length > 0;
        records.push({ agentMessage: agentQuestion, userAnswer: answered ? text : null });
        addMockTranscript(sessionData?.user.id ?? "user", answered ? text : NO_ANSWER);

        // Agent responds (normally already composed by the answer request)
        setPhase("ai-thinking");
        const agentTurn = submitted.agent ?? await getAgentResponse();
        if (shouldStop()) return;

        addMockTranscript(meeting.agent.id, agentTurn.text);
        currentTextRef.current = agentTurn.text;
        setCurrentText(agentTurn.text);

        setPhase("playing");
        await playAgentTurn(agentTurn);
        if (shouldStop()) return;
      }

      // 4. Check for unanswered questions
      const skipped = records.filter((r) => r.userAnswer === null);
      if (skipped.length > 0) {
        setUnanswered(skipped);
        setPhase("review");

        const decision = await waitForReviewDecision();
        if (shouldStop()) return;

        if (decision === "answer") {
          // Let user answer each skipped question (no agent response needed)
          for (const q of skipped) {
            if (shouldStop()) return;
            currentTextRef.current = q.agentMessage;
            setCurrentText(q.agentMessage);
            currentTimerRef.current = IS_MOCK ? MOCK_TIMER_S : TECH_TIMER_S;
            setPhase("user-turn");

            const result = await waitForUserTurn();
            if (shouldStop()) return;

            setPhase("transcribing");
            const { text } = await submitAnswer(result);
            if (shouldStop()) return;
            if (timeUpRef.current) { await finishSession(); return; }

            const answered = !result.skipped && text.length > 0;
            addMockTranscript(sessionData?.user.id ?? "user", answered ? text : NO_ANSWER);
          }
        }
      }

      // 5. Done
      if (!shouldStop()) {
        await finishSession();
      }
    } catch (err) {
      stopAudio();
      if (err instanceof TimeUpError && !shouldStop()) {
        timeUpRef.current = true;
        toast.info("Se acabó el tiempo de la entrevista. Finalizando...");
        await finishSession();
        return;
      }
      if (!shouldStop()) {
        console.error("[runSession]", err);
        toast.error(err instanceof Error ? err.message : "Error durante la entrevista.");
        setPhase("interrupted");
      }
    }
  };

  // "Iniciar entrevista" in the equipment check. Runs the session exactly once.
  const handleStart = () => {
    if (runStartedRef.current) return;
    runStartedRef.current = true;
    // Started inside the click, which also unlocks the audio element for the
    // rest of the interview in browsers with strict autoplay rules (Safari).
    const greeting = IS_MOCK ? null : playUrl(introAudioUrl(meeting.agent.id));
    if (IS_MOCK) unlockAudio();
    setPhase("starting");
    void runSession(greeting);
  };

  useEffect(() => {
    mountedRef.current = true;

    // A reload or a second tab: the server-side session cannot be resumed
    // from scratch, so offer to finish with what was recorded. An upcoming
    // interview waits on the equipment check (handleStart).
    if (initialStatusRef.current === "active") setPhase("interrupted");

    return () => {
      mountedRef.current = false;
      clearTimer();
      // Simulated StrictMode remounts happen before any clip exists.
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current = [];
      // The session clock is only cleared on real unmount; StrictMode's
      // simulated remount happens before the clock is started.
      clearSessionClock();
    };
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────────

  if (meeting.status === "completed") {
    return (
      <div className="flex h-screen items-center justify-center">
        <ErrorState title="Esta entrevista ya finalizó" description="Puedes ver el resumen en el historial de entrevistas" />
      </div>
    );
  }
  if (meeting.status === "cancelled") {
    return (
      <div className="flex h-screen items-center justify-center">
        <ErrorState title="Entrevista cancelada" description="Esta entrevista fue cancelada" />
      </div>
    );
  }
  if (initialStatusRef.current === "processing" || initialStatusRef.current === "failed") {
    return (
      <div className="flex h-screen items-center justify-center">
        <ErrorState title="Esta entrevista ya finalizó" description="Estamos generando tu reporte; puedes verlo en el historial de entrevistas" />
      </div>
    );
  }

  const isTimerWarning   = secondsLeft > 0 && secondsLeft <= 15;
  const progressPercent  = (questionIndex / TOTAL_QUESTIONS) * 100;
  const isUserTurnActive = phase === "user-turn" || phase === "recording";
  const showSessionUI    = phase !== "review" && phase !== "interrupted" && phase !== "precheck";
  const micProblem       = !IS_MOCK && showSessionUI && (mic.status === "lost" || mic.status === "error");


  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <GeneratedAvatar seed={meeting.agent.name} variant="botttsNeutral" className="size-10 rounded-full" />
          <div>
            <p className="font-semibold text-slate-100">{meeting.agent.role}</p>
            <p className="text-xs text-slate-400 truncate max-w-[200px]">{meeting.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {IS_MOCK && (
            <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40 text-xs border">
              MODO PRUEBA
            </Badge>
          )}
          {sessionSecondsLeft !== null && phase !== "interrupted" && phase !== "finishing" && phase !== "done" && (
            <Badge
              variant="outline"
              title={`Tiempo total restante (máximo ${MAX_SESSION_MINUTES} min)`}
              className={cn(
                "text-xs font-mono tabular-nums",
                sessionSecondsLeft <= 60 ? "text-red-300 border-red-500/60" : "text-slate-300 border-slate-600",
              )}
            >
              ⏱ {formatClock(sessionSecondsLeft)}
            </Badge>
          )}
          {showSessionUI && (
            <Badge variant="outline" className="text-slate-300 border-slate-600 text-xs">
              {Math.min(questionIndex + 1, TOTAL_QUESTIONS)} / {TOTAL_QUESTIONS}
            </Badge>
          )}
          {phase === "precheck" ? (
            <Button
              variant="ghost" size="sm"
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 gap-1"
              onClick={() => { mic.release(); router.push(`/meetings/${meetingId}`); }}
            >
              <ArrowLeftIcon className="size-4" />
              Salir
            </Button>
          ) : (
            <Button
              variant="ghost" size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-900/20 gap-1"
              onClick={finishSession}
              disabled={phase === "finishing" || phase === "starting" || phase === "done"}
            >
              <PhoneOffIcon className="size-4" />
              Finalizar
            </Button>
          )}
        </div>
      </div>

      {/* ── Progress bar ── */}
      {showSessionUI && (
        <div className="h-0.5 bg-slate-700">
          <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${progressPercent}%` }} />
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 max-w-2xl mx-auto w-full">

        {/* ── PRECHECK phase ── */}
        {phase === "precheck" && (
          <MicCheck
            mic={mic}
            onPlayTestSound={playTestSound}
            onStart={handleStart}
            skipMic={IS_MOCK}
            consentAccepted={consentQuery.data ? consentQuery.data.accepted : null}
            onAcceptConsent={() => acceptConsent.mutate({ version: CONSENT_VERSION })}
            acceptingConsent={acceptConsent.isPending}
          />
        )}

        {/* ── Microphone lost mid-interview ── */}
        {micProblem && (
          <div role="alert" className="w-full flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm">
            <TriangleAlertIcon className="size-4 shrink-0 text-amber-400" />
            <div className="flex-1">
              <p className="font-medium text-amber-200">
                {mic.status === "lost" || !mic.error ? "Se desconectó tu micrófono" : MIC_ERROR_MESSAGES[mic.error].title}
              </p>
              <p className="text-amber-100/70 text-xs mt-0.5">
                {mic.status === "lost" || !mic.error
                  ? "Vuelve a conectarlo y pulsa reconectar. El tiempo de la entrevista sigue corriendo."
                  : MIC_ERROR_MESSAGES[mic.error].hint}
              </p>
            </div>
            <Button size="sm" onClick={() => void mic.acquire()} className="bg-amber-500 hover:bg-amber-400 text-slate-900 shrink-0">
              Reconectar micrófono
            </Button>
          </div>
        )}

        {/* ── INTERRUPTED phase ── */}
        {phase === "interrupted" && (
          <div className="w-full flex flex-col items-center gap-5 text-center">
            <TriangleAlertIcon className="size-10 text-amber-400" />
            <div>
              <h2 className="text-xl font-semibold text-slate-100">La entrevista se interrumpió</h2>
              <p className="text-sm text-slate-400 mt-1">
                No es posible reanudarla. Puedes finalizarla y generar el reporte con las respuestas que ya se registraron.
              </p>
            </div>
            <Button onClick={finishSession} className="bg-blue-600 hover:bg-blue-500 gap-2">
              <CheckIcon className="size-4" />
              Finalizar y generar reporte
            </Button>
          </div>
        )}

        {/* ── REVIEW phase ── */}
        {phase === "review" && (
          <div className="w-full flex flex-col gap-6">
            <div className="text-center">
              <h2 className="text-xl font-semibold text-slate-100">
                {unanswered.length === 1
                  ? "Tienes 1 pregunta sin responder"
                  : `Tienes ${unanswered.length} preguntas sin responder`}
              </h2>
              <p className="text-sm text-slate-400 mt-1">¿Quieres responderlas antes de finalizar?</p>
            </div>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
              {unanswered.map((q, i) => (
                <div key={i} className="rounded-xl bg-slate-800/60 border border-slate-700/60 px-4 py-3 text-sm text-slate-300 line-clamp-2">
                  {q.agentMessage.length > 120 ? q.agentMessage.slice(0, 120) + "…" : q.agentMessage}
                </div>
              ))}
            </div>

            <div className="flex gap-3 justify-center">
              <Button
                onClick={() => { reviewDecisionResolveRef.current?.("answer"); reviewDecisionResolveRef.current = null; }}
                className="bg-blue-600 hover:bg-blue-500 gap-2"
              >
                <MicIcon className="size-4" />
                Responder preguntas pendientes
              </Button>
              <Button
                variant="ghost"
                className="text-slate-400 hover:text-slate-200 gap-2"
                onClick={() => { reviewDecisionResolveRef.current?.("finish"); reviewDecisionResolveRef.current = null; }}
              >
                <CheckIcon className="size-4" />
                Finalizar entrevista
              </Button>
            </div>
          </div>
        )}

        {/* ── Normal phases ── */}
        {showSessionUI && (
          <>
            {/* Agent message card */}
            <div className="w-full rounded-2xl bg-slate-800/60 border border-slate-700/60 p-6 min-h-[120px] flex items-start">
              {(phase === "starting" || phase === "ai-thinking") && (
                <div className="flex items-center gap-3 text-slate-400">
                  <LoaderIcon className="animate-spin size-5 shrink-0" />
                  <span className="text-sm">
                    {phase === "starting" ? "Preparando tus preguntas..." : "El entrevistador está preparando la siguiente pregunta..."}
                  </span>
                </div>
              )}
              {(phase === "playing" || isUserTurnActive || phase === "transcribing") && (
                <p className="text-base leading-relaxed text-slate-100">{currentText}</p>
              )}
              {(phase === "finishing" || phase === "done") && (
                <div className="flex items-center gap-3 text-slate-400">
                  <LoaderIcon className="animate-spin size-5 shrink-0" />
                  <span className="text-sm">Finalizando entrevista y generando resumen...</span>
                </div>
              )}
            </div>

            {/* User turn controls */}
            {isUserTurnActive && (
              <div className="flex flex-col items-center gap-5 w-full">

                {/* Timer — only visible while recording */}
                <div className={cn(
                  "text-5xl font-mono font-bold tabular-nums tracking-tight transition-all duration-300",
                  phase === "recording"
                    ? isTimerWarning ? "text-red-400" : "text-slate-200"
                    : "text-slate-700 select-none" // dim before recording starts
                )}>
                  {formatClock(phase === "recording" ? secondsLeft : currentTimerRef.current)}
                </div>

                {/* PTT button */}
                <button
                  onClick={phase === "user-turn" ? handleStartRecording : handleStopRecording}
                  className={cn(
                    "size-24 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
                    phase === "recording"
                      ? "bg-red-500 hover:bg-red-600 scale-110 ring-4 ring-red-400/40 focus-visible:ring-red-400"
                      : "bg-blue-600 hover:bg-blue-500 focus-visible:ring-blue-400"
                  )}
                  aria-label={phase === "recording" ? "Enviar respuesta" : "Comenzar a hablar"}
                >
                  <MicIcon className="size-10" />
                </button>

                <p className="text-sm text-slate-400">
                  {phase === "recording" ? "Pulsa para enviar tu respuesta" : "Pulsa para comenzar a hablar"}
                </p>

                {/* Skip button */}
                <Button
                  variant="ghost" size="sm"
                  className="text-slate-500 hover:text-slate-300 gap-1 text-xs"
                  onClick={handleSkipQuestion}
                >
                  <SkipForwardIcon className="size-3.5" />
                  Pasar pregunta
                </Button>
              </div>
            )}

            {/* Transcribing */}
            {phase === "transcribing" && (
              <div className="flex items-center gap-3 text-slate-400">
                <LoaderIcon className="animate-spin size-5" />
                <span className="text-sm">Procesando tu respuesta...</span>
              </div>
            )}

            {/* Playing indicator */}
            {phase === "playing" && (
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <span className="size-1.5 rounded-full bg-blue-400 animate-ping inline-block" />
                Reproduciendo...
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Footer ── */}
      {showSessionUI && (
        <div className="px-6 py-3 text-center text-xs text-slate-600 border-t border-slate-700/50">
          {questionIndex < TECH_QUESTIONS
            ? `Pregunta técnica ${questionIndex + 1} de ${TECH_QUESTIONS} — tienes ${TECH_TIMER_S}s para responder`
            : `Pregunta soft skill ${questionIndex - TECH_QUESTIONS + 1} de ${TOTAL_QUESTIONS - TECH_QUESTIONS} — tienes ${SOFT_TIMER_S}s para responder`}
        </div>
      )}

    </div>
  );
};
