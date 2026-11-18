"use client";

import { ArrowLeftIcon, PhoneOffIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GeneratedAvatar } from "@/components/ui/generated-avatar";
import { cn } from "@/lib/utils";
import { MAX_SESSION_MINUTES, TOTAL_QUESTIONS } from "@/modules/call/constants";
import { IS_MOCK } from "@/modules/call/ui/mock-session";
import { formatClock, type Phase } from "@/modules/call/ui/session-types";

interface Props {
  agent: { name: string; role: string };
  meetingName: string;
  phase: Phase;
  questionIndex: number;
  sessionSecondsLeft: number | null;
  showProgress: boolean;
  onExit: () => void;
  onFinish: () => void;
}

export const InterviewHeader = ({
  agent, meetingName, phase, questionIndex, sessionSecondsLeft, showProgress, onExit, onFinish,
}: Props) => {
  const showClock = sessionSecondsLeft !== null && phase !== "interrupted" && phase !== "finishing" && phase !== "done";

  return (
    <>
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50">
        <div className="flex items-center gap-3">
          <GeneratedAvatar seed={agent.name} variant="botttsNeutral" className="size-10 rounded-full" />
          <div>
            <p className="font-semibold text-slate-100">{agent.role}</p>
            <p className="text-xs text-slate-400 truncate max-w-[200px]">{meetingName}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {IS_MOCK && (
            <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40 text-xs border">
              MODO PRUEBA
            </Badge>
          )}
          {showClock && (
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
          {showProgress && (
            <Badge variant="outline" className="text-slate-300 border-slate-600 text-xs">
              {Math.min(questionIndex + 1, TOTAL_QUESTIONS)} / {TOTAL_QUESTIONS}
            </Badge>
          )}
          {phase === "precheck" ? (
            <Button
              variant="ghost" size="sm"
              className="text-slate-400 hover:text-slate-200 hover:bg-slate-700/40 gap-1"
              onClick={onExit}
            >
              <ArrowLeftIcon className="size-4" />
              Salir
            </Button>
          ) : (
            <Button
              variant="ghost" size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-900/20 gap-1"
              onClick={onFinish}
              disabled={phase === "finishing" || phase === "starting" || phase === "done"}
            >
              <PhoneOffIcon className="size-4" />
              Finalizar
            </Button>
          )}
        </div>
      </div>

      {showProgress && (
        <div className="h-0.5 bg-slate-700">
          <div
            className="h-full bg-blue-500 transition-all duration-700"
            style={{ width: `${(questionIndex / TOTAL_QUESTIONS) * 100}%` }}
          />
        </div>
      )}
    </>
  );
};
