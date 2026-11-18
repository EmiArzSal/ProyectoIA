"use client";

import { LoaderIcon } from "lucide-react";

import { KaraokeText, type KaraokeRange } from "@/modules/call/ui/components/karaoke-text";
import type { Phase } from "@/modules/call/ui/session-types";

interface Props {
  phase: Phase;
  text: string;
  karaoke: KaraokeRange | null;
  audio: HTMLAudioElement | null;
}

const Waiting = ({ children, small }: { children: React.ReactNode; small?: boolean }) => (
  <div className="flex items-center gap-2 text-slate-400">
    <LoaderIcon className={small ? "animate-spin size-4 shrink-0" : "animate-spin size-5 shrink-0"} />
    <span className={small ? "text-xs" : "text-sm"}>{children}</span>
  </div>
);

/** The interviewer's message, or what the interview is waiting for. */
export const AgentMessageCard = ({ phase, text, karaoke, audio }: Props) => {
  const showsText = phase === "playing" || phase === "user-turn" || phase === "recording" || phase === "transcribing";

  return (
    <div className="w-full rounded-2xl bg-slate-800/60 border border-slate-700/60 p-6 min-h-[120px] flex items-start">
      {phase === "starting" && text && (
        // The greeting plays while the server writes the questions.
        <div className="flex flex-col gap-3">
          <KaraokeText text={text} range={karaoke} audio={audio} />
          <Waiting small>Preparando tus preguntas...</Waiting>
        </div>
      )}
      {phase === "starting" && !text && <Waiting>Preparando tus preguntas...</Waiting>}
      {phase === "ai-thinking" && <Waiting>El entrevistador está preparando la siguiente pregunta...</Waiting>}
      {showsText && <KaraokeText text={text} range={karaoke} audio={audio} />}
      {(phase === "finishing" || phase === "done") && <Waiting>Finalizando entrevista y generando resumen...</Waiting>}
    </div>
  );
};
