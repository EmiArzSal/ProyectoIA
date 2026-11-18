"use client";

import { MicIcon, SkipForwardIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatClock } from "@/modules/call/ui/session-types";

interface Props {
  recording: boolean;
  secondsLeft: number;
  /** Shown dimmed before recording starts. */
  timeLimit: number;
  onStart: () => void;
  onStop: () => void;
  onSkip: () => void;
}

/** Push-to-talk button, the question's countdown and "Pasar pregunta". */
export const AnswerControls = ({ recording, secondsLeft, timeLimit, onStart, onStop, onSkip }: Props) => {
  const warning = secondsLeft > 0 && secondsLeft <= 15;

  return (
    <div className="flex flex-col items-center gap-5 w-full">
      <div className={cn(
        "text-5xl font-mono font-bold tabular-nums tracking-tight transition-all duration-300",
        recording
          ? warning ? "text-red-400" : "text-slate-200"
          : "text-slate-700 select-none",
      )}>
        {formatClock(recording ? secondsLeft : timeLimit)}
      </div>

      <button
        onClick={recording ? onStop : onStart}
        className={cn(
          "size-24 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900",
          recording
            ? "bg-red-500 hover:bg-red-600 scale-110 ring-4 ring-red-400/40 focus-visible:ring-red-400"
            : "bg-blue-600 hover:bg-blue-500 focus-visible:ring-blue-400",
        )}
        aria-label={recording ? "Enviar respuesta" : "Comenzar a hablar"}
      >
        <MicIcon className="size-10" />
      </button>

      <p className="text-sm text-slate-400">
        {recording ? "Pulsa para enviar tu respuesta" : "Pulsa para comenzar a hablar"}
      </p>

      <Button
        variant="ghost" size="sm"
        className="text-slate-500 hover:text-slate-300 gap-1 text-xs"
        onClick={onSkip}
      >
        <SkipForwardIcon className="size-3.5" />
        Pasar pregunta
      </Button>
    </div>
  );
};
