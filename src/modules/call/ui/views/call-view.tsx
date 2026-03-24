"use client";

import { useState, useRef, useEffect } from "react";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { GeneratedAvatar } from "@/components/ui/generated-avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MicIcon,
  LoaderIcon,
  PhoneOffIcon,
  SkipForwardIcon,
  CheckIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { ErrorState } from "@/components/error-state";

// ── Constants ──────────────────────────────────────────────────────────────────

const TOTAL_QUESTIONS = 10;
const TECH_QUESTIONS = 6;  // 0–5 → 60 s
const TECH_TIMER_S   = 60;
const SOFT_TIMER_S   = 90; // 6–9 → 90 s

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
  | "starting"
  | "ai-thinking"
  | "playing"
  | "user-turn"    // waiting for mic (no timer yet)
  | "recording"    // mic open → timer running
  | "transcribing"
  | "review"       // summary of unanswered questions
  | "finishing"    // endMeeting in progress
  | "done";

type ChatMessage = { role: "user" | "assistant"; content: string };

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

type UserTurnResult = { text: string; skipped: boolean };

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

  // ── State ────────────────────────────────────────────────────────────────────

  const [phase, setPhaseState]         = useState<Phase>("starting");
  const [currentText, setCurrentText]  = useState("");
  const currentTextRef                 = useRef("");
  const [secondsLeft, setSecondsLeft]  = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [unanswered, setUnanswered]    = useState<QuestionRecord[]>([]);
  // const [reviewStep, setReviewStep]    = useState(0); // current unanswered being reviewed

  // ── Refs ─────────────────────────────────────────────────────────────────────

  const phaseRef        = useRef<Phase>("starting");
  const sessionStartRef = useRef(0);
  const transcriptRef   = useRef<TranscriptItem[]>([]);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef   = useRef<Blob[]>([]);
  const timerRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  // Timer seconds for the currently active question
  const currentTimerRef  = useRef(TECH_TIMER_S);

  // Promise resolvers
  const userTurnResolveRef     = useRef<((r: UserTurnResult) => void) | null>(null);
  const reviewDecisionResolveRef = useRef<((d: "answer" | "finish") => void) | null>(null);

  // Skip flag: set before stopping MediaRecorder so onstop knows not to transcribe
  const skipRecordingRef = useRef(false);

  // Set to true when finishSession is called — stops the async loop cleanly
  const isStoppingRef = useRef(false);

  // Mock mode counters
  const mockResponseIdxRef = useRef(0);
  const mockAnswerIdxRef   = useRef(0);

  // ── Helpers ──────────────────────────────────────────────────────────────────

  const setPhase = (p: Phase) => { phaseRef.current = p; setPhaseState(p); };

  const clearTimer = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  };

  const addToTranscript = (speakerId: string, text: string) => {
    const now = Date.now() - sessionStartRef.current;
    transcriptRef.current.push({ speaker_id: speakerId, type: "text", text, start_ts: now, stop_ts: now + 500 });
  };

  const playTTS = async (text: string): Promise<void> => {
    if (IS_MOCK) {
      await new Promise<void>((r) => setTimeout(r, 300));
      return;
    }
    try {
      const res = await fetch("/api/session/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      await new Promise<void>((resolve) => {
        const audio = new Audio(url);
        audio.onended = () => { URL.revokeObjectURL(url); resolve(); };
        audio.onerror = () => { URL.revokeObjectURL(url); resolve(); };
        audio.play().catch(() => resolve());
      });
    } catch { /* silent — text always visible */ }
  };

  const getAgentResponse = async (history: ChatMessage[]): Promise<string> => {
    if (IS_MOCK) {
      await new Promise<void>((r) => setTimeout(r, 400));
      const idx = mockResponseIdxRef.current++;
      return MOCK_AGENT_RESPONSES[Math.min(idx, MOCK_AGENT_RESPONSES.length - 1)];
    }
    const res = await fetch("/api/session/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, systemPrompt: meeting.agent.instructions }),
    });
    if (!res.ok) throw new Error("Error al obtener respuesta del agente");
    const data = await res.json();
    return data.text as string;
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
        resolveUserTurn({ text: answer, skipped: false });
      }, 1500);
      return;
    }

    try {
      const stream   = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearTimer();

        // Skip path: don't transcribe, just resolve as skipped
        if (skipRecordingRef.current) {
          skipRecordingRef.current = false;
          resolveUserTurn({ text: "", skipped: true });
          return;
        }

        if (isStoppingRef.current || phaseRef.current === "done") return;

        setPhase("transcribing");

        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        let text = "";
        try {
          const formData = new FormData();
          formData.append("audio", blob, "recording.webm");
          const res = await fetch("/api/session/transcribe", { method: "POST", body: formData });
          if (res.ok) { const d = await res.json(); text = d.text ?? ""; }
        } catch { /* fallback: empty answer */ }

        resolveUserTurn({ text, skipped: false });
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setPhase("recording");
      startCountdown(); // ← timer starts here, when mic opens
    } catch {
      toast.error("No se pudo acceder al micrófono. Verifica los permisos.");
    }
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
      resolveUserTurn({ text: "", skipped: true });
    }
  };

  // ── Finalize ─────────────────────────────────────────────────────────────────

  const endMeeting = useMutation(trpc.meetings.endMeeting.mutationOptions());

  const finishSession = async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    setPhase("finishing");
    clearTimer();

    // Resolve any pending promises so the async loop can exit
    resolveUserTurn({ text: "", skipped: true });
    reviewDecisionResolveRef.current?.("finish");
    reviewDecisionResolveRef.current = null;

    // Stop mic if still active
    if (mediaRecorderRef.current?.state === "recording") {
      skipRecordingRef.current = true;
      mediaRecorderRef.current.stop();
      await new Promise<void>((r) => setTimeout(r, 300));
    }

    const jsonl = transcriptRef.current.map((item) => JSON.stringify(item)).join("\n");

    try {
      await endMeeting.mutateAsync({ id: meetingId, transcript: jsonl || " " });
      await queryClient.invalidateQueries(trpc.meetings.getOne.queryOptions({ id: meetingId }));
      toast.success("Entrevista finalizada. Generando resumen...");
      router.push(`/meetings/${meetingId}`);
    } catch (err) {
      console.error("[finishSession]", err);
      toast.error("Error al finalizar la entrevista . Intenta de nuevo.");
      setPhase("user-turn");
    }
  };

  // ── Main session runner ───────────────────────────────────────────────────────

  const startMeeting = useMutation(trpc.meetings.startMeeting.mutationOptions());

  useEffect(() => {
    if (meeting.status === "completed" || meeting.status === "cancelled") return;

    sessionStartRef.current = Date.now();
    let cancelled = false;

    const run = async () => {
      try {
        // 1. Activate meeting
        await startMeeting.mutateAsync({ id: meetingId });
        if (cancelled) return;

        // 2. Initial greeting + first question
        setPhase("ai-thinking");
        const introText = await getAgentResponse([]);
        if (cancelled) return;

        addToTranscript(meeting.agent.id, introText);
        currentTextRef.current = introText;
        setCurrentText(introText);
        let history: ChatMessage[] = [{ role: "assistant", content: introText }];

        setPhase("playing");
        await playTTS(introText);
        if (cancelled) return;

        // 3. 10-question loop
        const records: QuestionRecord[] = [];

        for (let i = 0; i < TOTAL_QUESTIONS; i++) {
          if (cancelled || isStoppingRef.current) return;

          currentTimerRef.current = IS_MOCK ? MOCK_TIMER_S : (i < TECH_QUESTIONS ? TECH_TIMER_S : SOFT_TIMER_S);
          setQuestionIndex(i);
          // Capture the current question text for the record
          const agentQuestion = currentTextRef.current;
          setPhase("user-turn");

          const result = await waitForUserTurn();
          if (cancelled || isStoppingRef.current) return;

          records.push({
            agentMessage: agentQuestion,
            userAnswer: result.skipped || !result.text ? null : result.text,
          });

          const userText = (!result.skipped && result.text) ? result.text : "(sin respuesta)";
          addToTranscript(sessionData?.user.id ?? "user", userText);
          history = [
            ...history,
            { role: "user", content: userText },
          ];

          // Agent responds
          setPhase("ai-thinking");
          const agentText = await getAgentResponse(history);
          if (cancelled || isStoppingRef.current) return;

          addToTranscript(meeting.agent.id, agentText);
          history = [...history, { role: "assistant", content: agentText }];
          currentTextRef.current = agentText;
          setCurrentText(agentText);

          setPhase("playing");
          await playTTS(agentText);
          if (cancelled || isStoppingRef.current) return;
        }

        // 4. Check for unanswered questions
        const skipped = records.filter((r) => r.userAnswer === null);
        if (skipped.length > 0) {
          setUnanswered(skipped);
          // setReviewStep(0);
          setPhase("review");

          const decision = await waitForReviewDecision();
          if (cancelled || isStoppingRef.current) return;

          if (decision === "answer") {
            // Let user answer each skipped question (no agent response needed)
            for (let idx = 0; idx < skipped.length; idx++) {
              if (cancelled || isStoppingRef.current) return;
              const q = skipped[idx];
              // setReviewStep(idx);
              currentTextRef.current = q.agentMessage;
              setCurrentText(q.agentMessage);
              currentTimerRef.current = IS_MOCK ? MOCK_TIMER_S : TECH_TIMER_S;
              setPhase("user-turn");

              const result = await waitForUserTurn();
              if (cancelled || isStoppingRef.current) return;

              const reviewText = (!result.skipped && result.text) ? result.text : "(sin respuesta)";
              addToTranscript(sessionData?.user.id ?? "user", reviewText);
              history = [...history, { role: "user", content: reviewText }];
            }
          }
        }

        // 5. Done
        if (!cancelled && !isStoppingRef.current) {
          await finishSession();
        }
      } catch (err) {
        if (!cancelled && !isStoppingRef.current) {
          console.error("[runSession]", err);
          toast.error("Error durante la entrevista . Puedes finalizar manualmente.");
        }
      }
    };

    run();

    return () => {
      cancelled = true;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const isTimerWarning   = secondsLeft > 0 && secondsLeft <= 15;
  const progressPercent  = (questionIndex / TOTAL_QUESTIONS) * 100;
  const isUserTurnActive = phase === "user-turn" || phase === "recording";

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
          {phase !== "review" && (
            <Badge variant="outline" className="text-slate-300 border-slate-600 text-xs">
              {Math.min(questionIndex + 1, TOTAL_QUESTIONS)} / {TOTAL_QUESTIONS}
            </Badge>
          )}
          <Button
            variant="ghost" size="sm"
            className="text-red-400 hover:text-red-300 hover:bg-red-900/20 gap-1"
            onClick={finishSession}
            disabled={phase === "finishing" || phase === "starting" || phase === "done"}
          >
            <PhoneOffIcon className="size-4" />
            Finalizar
          </Button>
        </div>
      </div>

      {/* ── Progress bar ── */}
      {phase !== "review" && (
        <div className="h-0.5 bg-slate-700">
          <div className="h-full bg-blue-500 transition-all duration-700" style={{ width: `${progressPercent}%` }} />
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 max-w-2xl mx-auto w-full">

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
        {phase !== "review" && (
          <>
            {/* Agent message card */}
            <div className="w-full rounded-2xl bg-slate-800/60 border border-slate-700/60 p-6 min-h-[120px] flex items-start">
              {(phase === "starting" || phase === "ai-thinking") && (
                <div className="flex items-center gap-3 text-slate-400">
                  <LoaderIcon className="animate-spin size-5 shrink-0" />
                  <span className="text-sm">
                    {phase === "starting" ? "Iniciando entrevista ..." : "El entrevistador está preparando la siguiente pregunta..."}
                  </span>
                </div>
              )}
              {(phase === "playing" || isUserTurnActive || phase === "transcribing") && (
                <p className="text-base leading-relaxed text-slate-100">{currentText}</p>
              )}
              {phase === "finishing" && (
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
                  {phase === "recording"
                    ? `${String(Math.floor(secondsLeft / 60)).padStart(2, "0")}:${String(secondsLeft % 60).padStart(2, "0")}`
                    : `${String(Math.floor(currentTimerRef.current / 60)).padStart(2, "0")}:${String(currentTimerRef.current % 60).padStart(2, "0")}`
                  }
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
      {phase !== "review" && (
        <div className="px-6 py-3 text-center text-xs text-slate-600 border-t border-slate-700/50">
          {questionIndex < TECH_QUESTIONS
            ? `Pregunta técnica ${questionIndex + 1} de ${TECH_QUESTIONS} — tienes ${TECH_TIMER_S}s para responder`
            : `Pregunta soft skill ${questionIndex - TECH_QUESTIONS + 1} de ${TOTAL_QUESTIONS - TECH_QUESTIONS} — tienes ${SOFT_TIMER_S}s para responder`}
        </div>
      )}

    </div>
  );
};
