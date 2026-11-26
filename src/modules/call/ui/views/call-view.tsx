"use client";

import { useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { LoaderIcon } from "lucide-react";
import { toast } from "sonner";

import { ErrorState } from "@/components/error-state";
import { CONSENT_VERSION } from "@/lib/consent";
import { useTRPC } from "@/trpc/client";
import { SOFT_TIMER_S, TECH_QUESTIONS, TECH_TIMER_S, TOTAL_QUESTIONS } from "@/modules/call/constants";
import { AgentMessageCard } from "@/modules/call/ui/components/agent-message-card";
import { AnswerControls } from "@/modules/call/ui/components/answer-controls";
import { InterviewHeader } from "@/modules/call/ui/components/interview-header";
import { MicCheck } from "@/modules/call/ui/components/mic-check";
import { InterruptedPanel, MicProblemBanner, ReviewPanel } from "@/modules/call/ui/components/session-panels";
import { useInterviewSession } from "@/modules/call/ui/hooks/use-interview-session";
import { IS_MOCK } from "@/modules/call/ui/mock-session";

// The interview screen. The flow lives in useInterviewSession (with
// useInterviewerVoice and useAnswerRecorder); this file only lays it out.

interface Props { meetingId: string }

export const CallView = ({ meetingId }: Props) => {
  const trpc        = useTRPC();
  const queryClient = useQueryClient();

  const { data: meeting } = useSuspenseQuery(trpc.meetings.getOne.queryOptions({ id: meetingId }));
  const session = useInterviewSession(meeting);
  const { phase, mic, voice, recorder } = session;

  // Recording consent (enforced again by startMeeting on the server).
  const consentQuery = useQuery({
    ...trpc.consent.getStatus.queryOptions(),
    enabled: session.initialStatus === "upcoming",
  });
  const acceptConsent = useMutation(trpc.consent.accept.mutationOptions({
    onSuccess: () => queryClient.invalidateQueries(trpc.consent.getStatus.queryOptions()),
    onError: (err) => toast.error(err.message),
  }));

  if (meeting.status === "completed") {
    return <Finished title="Esta entrevista ya finalizó" description="Puedes ver el resumen en el historial de entrevistas" />;
  }
  if (session.initialStatus === "processing" || session.initialStatus === "failed") {
    return <Finished title="Esta entrevista ya finalizó" description="Estamos generando tu reporte; puedes verlo en el historial de entrevistas" />;
  }

  const isUserTurn     = phase === "user-turn" || phase === "recording";
  const showSessionUI  = phase !== "review" && phase !== "interrupted" && phase !== "precheck";
  const micProblem     = !IS_MOCK && showSessionUI && (mic.status === "lost" || mic.status === "error");
  const isTechQuestion = session.questionIndex < TECH_QUESTIONS;

  return (
    <div className="flex h-screen flex-col bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <InterviewHeader
        agent={meeting.agent}
        meetingName={meeting.name}
        phase={phase}
        questionIndex={session.questionIndex}
        sessionSecondsLeft={session.sessionSecondsLeft}
        showProgress={showSessionUI}
        onExit={session.exit}
        onFinish={session.finish}
      />

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-8 max-w-2xl mx-auto w-full">
        {phase === "precheck" && (
          <MicCheck
            mic={mic}
            onPlayTestSound={voice.playTestSound}
            onStart={session.start}
            skipMic={IS_MOCK}
            consentAccepted={consentQuery.data ? consentQuery.data.accepted : null}
            onAcceptConsent={() => acceptConsent.mutate({ version: CONSENT_VERSION })}
            acceptingConsent={acceptConsent.isPending}
          />
        )}

        {micProblem && <MicProblemBanner mic={mic} />}
        {phase === "interrupted" && <InterruptedPanel onFinish={session.finish} />}
        {phase === "review" && <ReviewPanel unanswered={session.unanswered} onDecide={session.decideReview} />}

        {showSessionUI && (
          <>
            <AgentMessageCard
              phase={phase}
              text={session.currentText}
              karaoke={voice.karaoke}
              audio={voice.audioElement}
            />

            {isUserTurn && (
              <AnswerControls
                recording={phase === "recording"}
                secondsLeft={recorder.secondsLeft}
                timeLimit={recorder.timeLimit}
                onStart={recorder.startRecording}
                onStop={recorder.stopRecording}
                onSkip={recorder.skip}
              />
            )}

            {phase === "transcribing" && <Status>Procesando tu respuesta...</Status>}
            {phase === "playing" && (
              <div className="flex items-center gap-2 text-slate-500 text-xs">
                <span className="size-1.5 rounded-full bg-blue-400 animate-ping inline-block" />
                Reproduciendo...
              </div>
            )}
          </>
        )}
      </div>

      {showSessionUI && (
        <div className="px-6 py-3 text-center text-xs text-slate-600 border-t border-slate-700/50">
          {isTechQuestion
            ? `Pregunta técnica ${session.questionIndex + 1} de ${TECH_QUESTIONS} — tienes ${TECH_TIMER_S}s para responder`
            : `Pregunta soft skill ${session.questionIndex - TECH_QUESTIONS + 1} de ${TOTAL_QUESTIONS - TECH_QUESTIONS} — tienes ${SOFT_TIMER_S}s para responder`}
        </div>
      )}
    </div>
  );
};

const Finished = ({ title, description }: { title: string; description: string }) => (
  <div className="flex h-screen items-center justify-center">
    <ErrorState title={title} description={description} />
  </div>
);

const Status = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-3 text-slate-400">
    <LoaderIcon className="animate-spin size-5" />
    <span className="text-sm">{children}</span>
  </div>
);
