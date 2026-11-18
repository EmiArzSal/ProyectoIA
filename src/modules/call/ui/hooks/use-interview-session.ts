"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { TRPCClientError } from "@trpc/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import {
  MAX_SESSION_MS,
  NO_ANSWER,
  SOFT_TIMER_S,
  TECH_QUESTIONS,
  TECH_TIMER_S,
  TOTAL_QUESTIONS,
} from "@/modules/call/constants";
import { introText } from "@/modules/call/interviewer-script";
import { useAnswerRecorder } from "@/modules/call/ui/hooks/use-answer-recorder";
import { useInterviewerVoice } from "@/modules/call/ui/hooks/use-interviewer-voice";
import { useMicrophone } from "@/modules/call/ui/hooks/use-microphone";
import { IS_MOCK, MOCK_AGENT_RESPONSES, MOCK_TIMER_S } from "@/modules/call/ui/mock-session";
import { requestAgentTurn, sendAnswer, TimeUpError } from "@/modules/call/ui/session-api";
import type { AgentTurn, Phase, PlayOutcome, QuestionRecord, UserTurnResult } from "@/modules/call/ui/session-types";
import type { MeetingGetOne, TranscriptItem } from "@/modules/meetings/types";

const trpcErrorCode = (err: unknown) =>
  err instanceof TRPCClientError ? (err.data as { code?: string } | undefined)?.code : undefined;

const answerTimeLimit = (questionIndex: number) =>
  IS_MOCK ? MOCK_TIMER_S : questionIndex < TECH_QUESTIONS ? TECH_TIMER_S : SOFT_TIMER_S;

/**
 * Runs one interview from the "Iniciar entrevista" click to the report:
 * greeting, the 10 questions, the optional review of skipped ones, and
 * finishing. The flow is a single async loop that reads top to bottom; the
 * voice and the answer recording live in their own hooks.
 *
 * The server is the source of truth (plan, transcript, time limit); the loop
 * only drives the screen and stops as soon as the interview is finishing or
 * the page is gone (shouldStop).
 */
export function useInterviewSession(meeting: MeetingGetOne) {
  const meetingId   = meeting.id;
  const trpc        = useTRPC();
  const router      = useRouter();
  const queryClient = useQueryClient();
  const { data: sessionData } = authClient.useSession();

  // Status when the page loaded. The live query is invalidated while finishing,
  // so decisions about whether to run the session use this snapshot.
  const initialStatusRef = useRef(meeting.status);

  // An interview that has not started opens on the equipment check; the
  // interview (and the daily quota) starts only from its button.
  const initialPhase: Phase = initialStatusRef.current === "upcoming" ? "precheck" : "starting";
  const [phase, setPhaseState] = useState<Phase>(initialPhase);
  const phaseRef = useRef<Phase>(initialPhase);
  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  const [currentText, setCurrentTextState] = useState("");
  const currentTextRef = useRef("");
  const setCurrentText = (text: string) => { currentTextRef.current = text; setCurrentTextState(text); };

  const [questionIndex, setQuestionIndex] = useState(0);
  const [unanswered, setUnanswered] = useState<QuestionRecord[]>([]);
  const [sessionSecondsLeft, setSessionSecondsLeft] = useState<number | null>(null);

  // Set when finishSession starts: the loop exits at its next check.
  const isStoppingRef = useRef(false);
  // Lifecycle guards. The loop must run exactly once per page load
  // (startMeeting is not repeatable); mountedRef survives React StrictMode's
  // simulated unmount/remount in development.
  const mountedRef    = useRef(false);
  const runStartedRef = useRef(false);
  const shouldStop = () => !mountedRef.current || isStoppingRef.current;

  // Whole-interview clock (the server enforces the same limit).
  const sessionTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeUpRef       = useRef(false);
  const clearSessionClock = () => {
    if (sessionTimerRef.current) { clearInterval(sessionTimerRef.current); sessionTimerRef.current = null; }
  };

  const reviewDecisionResolveRef = useRef<((d: "answer" | "finish") => void) | null>(null);

  // Mock mode only: the server builds the transcript in real interviews.
  const sessionStartRef    = useRef(0);
  const mockTranscriptRef  = useRef<TranscriptItem[]>([]);
  const mockResponseIdxRef = useRef(0);
  const addMockTranscript = (speakerId: string, text: string) => {
    if (!IS_MOCK) return;
    const now = Date.now() - sessionStartRef.current;
    mockTranscriptRef.current.push({ speaker_id: speakerId, type: "text", text, start_ts: now, stop_ts: now + 500 });
  };

  const mic      = useMicrophone({ monitorLevel: phase === "precheck" });
  const voice    = useInterviewerVoice({ meetingId, agent: meeting.agent, shouldStop });
  const recorder = useAnswerRecorder({ mic, phaseRef, setPhase, isStopping: () => isStoppingRef.current });

  const startMeeting = useMutation(trpc.meetings.startMeeting.mutationOptions());
  const endMeeting   = useMutation(trpc.meetings.endMeeting.mutationOptions());

  // ── Server calls (mock mode answers locally) ────────────────────────────────

  const getAgentTurn = async (): Promise<AgentTurn> => {
    if (IS_MOCK) {
      await new Promise<void>((r) => setTimeout(r, 400));
      const idx = mockResponseIdxRef.current++;
      return { text: MOCK_AGENT_RESPONSES[Math.min(idx, MOCK_AGENT_RESPONSES.length - 1)], clips: [] };
    }
    return requestAgentTurn(meetingId);
  };

  const submitAnswer = async (result: UserTurnResult): Promise<{ text: string; agent: AgentTurn | null }> => {
    if (IS_MOCK) return { text: result.skipped ? "" : (result.mockText ?? ""), agent: null };
    const submitted = await sendAnswer(meetingId, result.skipped ? null : result.audio);
    if (submitted.transcriptionFailed) {
      toast.error("No pudimos transcribir tu respuesta; se registró como sin respuesta.");
    }
    return submitted;
  };

  /** Waits for the answer to the question on screen and records it. */
  const askQuestion = async (timeLimit: number) => {
    const answer = recorder.waitForAnswer(timeLimit);
    setPhase("user-turn");
    const result = await answer;
    if (shouldStop()) return null;

    setPhase("transcribing");
    const submitted = await submitAnswer(result);
    const answered = !result.skipped && submitted.text.length > 0;
    addMockTranscript(sessionData?.user.id ?? "user", answered ? submitted.text : NO_ANSWER);
    return { ...submitted, answered };
  };

  const showAgentTurn = (turn: AgentTurn) => {
    addMockTranscript(meeting.agent.id, turn.text);
    setCurrentText(turn.text);
    setPhase("playing");
  };

  // ── Finish ──────────────────────────────────────────────────────────────────

  const finishSession = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    setPhase("finishing");
    clearSessionClock();
    voice.stopAudio();

    // Release every pending wait so the loop can exit.
    reviewDecisionResolveRef.current?.("finish");
    reviewDecisionResolveRef.current = null;
    await recorder.abort();
    mic.release();

    const mockTranscript = IS_MOCK
      ? mockTranscriptRef.current.map((item) => JSON.stringify(item)).join("\n")
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

  // ── Whole-interview clock ───────────────────────────────────────────────────

  // An answer being recorded when time runs out is still sent (the server
  // allows a grace period); then the session ends.
  const handleTimeUp = () => {
    if (timeUpRef.current || isStoppingRef.current) return;
    timeUpRef.current = true;
    clearSessionClock();
    toast.info("Se acabó el tiempo de la entrevista. Finalizando...");

    if (phaseRef.current === "recording") {
      recorder.sendNowForTimeUp(); // the loop submits the answer, then finishes
      return;
    }
    if (phaseRef.current === "transcribing") return; // the loop finishes after submit
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

  // ── The interview ───────────────────────────────────────────────────────────

  /** Activates the meeting. False when the interview cannot start (handled here). */
  const activateMeeting = async (): Promise<boolean> => {
    try {
      await startMeeting.mutateAsync({ id: meetingId });
      return true;
    } catch (err) {
      voice.stopAudio();
      const code = trpcErrorCode(err);
      if (code === "CONFLICT") { setPhase("interrupted"); return false; }
      if (code === "PRECONDITION_FAILED") {
        // Consent missing or outdated: back to the check, which asks for it.
        toast.error((err as Error).message);
        runStartedRef.current = false;
        setCurrentText("");
        await queryClient.invalidateQueries(trpc.consent.getStatus.queryOptions());
        setPhase("precheck");
        return false;
      }
      if (code === "TOO_MANY_REQUESTS") {
        toast.error((err as Error).message);
        router.push(`/meetings/${meetingId}`);
        return false;
      }
      throw err;
    }
  };

  // `greeting` is the pre-recorded greeting, already playing since the click
  // (null in mock mode). It covers the time startMeeting takes to write the plan.
  const runSession = async (greeting: Promise<PlayOutcome> | null) => {
    try {
      // 1. Activate the meeting (allowed once: upcoming → active).
      if (!(await activateMeeting())) return;
      void queryClient.invalidateQueries(trpc.meetings.getDailyUsage.queryOptions());
      if (shouldStop()) return;
      sessionStartRef.current = Date.now();
      if (!IS_MOCK) startSessionClock();
      voice.prefetchQuestion(0); // the plan exists now; ready by the end of the greeting

      // 2. Greeting + question 1. The phase stays "starting" until the intro
      // text arrives (it needs no model call).
      const intro = await getAgentTurn();
      if (shouldStop()) return;
      showAgentTurn(intro);
      await voice.finishIntro(greeting, intro);
      if (shouldStop()) return;

      // 3. The 10 questions.
      const records: QuestionRecord[] = [];
      for (let i = 0; i < TOTAL_QUESTIONS; i++) {
        if (shouldStop()) return;
        setQuestionIndex(i);
        const question = currentTextRef.current;
        voice.prefetchQuestion(i + 1); // asked after this answer

        const submitted = await askQuestion(answerTimeLimit(i));
        if (!submitted || shouldStop()) return;
        if (timeUpRef.current) { await finishSession(); return; }
        records.push({ agentMessage: question, userAnswer: submitted.answered ? submitted.text : null });

        // The interviewer's next message, normally composed by the answer request.
        setPhase("ai-thinking");
        const turn = submitted.agent ?? await getAgentTurn();
        if (shouldStop()) return;
        showAgentTurn(turn);
        await voice.playAgentTurn(turn);
        if (shouldStop()) return;
      }

      // 4. Offer to answer the skipped questions (no interviewer messages).
      const skipped = records.filter((r) => r.userAnswer === null);
      if (skipped.length > 0) {
        setUnanswered(skipped);
        setPhase("review");
        const decision = await new Promise<"answer" | "finish">((resolve) => {
          reviewDecisionResolveRef.current = resolve;
        });
        if (shouldStop()) return;

        if (decision === "answer") {
          for (const q of skipped) {
            if (shouldStop()) return;
            setCurrentText(q.agentMessage);
            const submitted = await askQuestion(IS_MOCK ? MOCK_TIMER_S : TECH_TIMER_S);
            if (!submitted || shouldStop()) return;
            if (timeUpRef.current) { await finishSession(); return; }
          }
        }
      }

      // 5. Done.
      if (!shouldStop()) await finishSession();
    } catch (err) {
      voice.stopAudio();
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

  /** "Iniciar entrevista" in the equipment check. Runs the session exactly once. */
  const start = () => {
    if (runStartedRef.current) return;
    runStartedRef.current = true;
    // Inside the click: see startGreeting.
    const greeting = voice.startGreeting();
    // Show what is being said; question 1 is added when the plan is ready.
    if (!IS_MOCK) setCurrentText(introText(meeting.agent));
    setPhase("starting");
    void runSession(greeting);
  };

  const decideReview = (decision: "answer" | "finish") => {
    reviewDecisionResolveRef.current?.(decision);
    reviewDecisionResolveRef.current = null;
  };

  /** Leaves the equipment check without starting. */
  const exit = () => {
    mic.release();
    router.push(`/meetings/${meetingId}`);
  };

  useEffect(() => {
    mountedRef.current = true;

    // A reload or a second tab: the server-side session cannot be resumed
    // from scratch, so offer to finish with what was recorded. An upcoming
    // interview waits on the equipment check (start).
    if (initialStatusRef.current === "active") setPhase("interrupted");

    return () => {
      mountedRef.current = false;
      // Only cleared on real unmount; StrictMode's simulated remount happens
      // before the clock is started.
      clearSessionClock();
    };
  }, []);

  return {
    initialStatus: initialStatusRef.current,
    phase,
    currentText,
    questionIndex,
    unanswered,
    sessionSecondsLeft,
    mic,
    voice,
    recorder,
    start,
    finish: finishSession,
    decideReview,
    exit,
  };
}

export type InterviewSession = ReturnType<typeof useInterviewSession>;
