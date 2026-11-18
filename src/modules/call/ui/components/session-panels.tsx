"use client";

import { CheckIcon, MicIcon, TriangleAlertIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MIC_ERROR_MESSAGES, type Microphone } from "@/modules/call/ui/hooks/use-microphone";
import type { QuestionRecord } from "@/modules/call/ui/session-types";

/** The microphone disconnected or failed mid-interview. */
export const MicProblemBanner = ({ mic }: { mic: Microphone }) => {
  const error = mic.status !== "lost" && mic.error ? MIC_ERROR_MESSAGES[mic.error] : null;
  return (
    <div role="alert" className="w-full flex items-center gap-3 rounded-xl bg-amber-500/10 border border-amber-500/30 px-4 py-3 text-sm">
      <TriangleAlertIcon className="size-4 shrink-0 text-amber-400" />
      <div className="flex-1">
        <p className="font-medium text-amber-200">
          {error ? error.title : "Se desconectó tu micrófono"}
        </p>
        <p className="text-amber-100/70 text-xs mt-0.5">
          {error ? error.hint : "Vuelve a conectarlo y pulsa reconectar. El tiempo de la entrevista sigue corriendo."}
        </p>
      </div>
      <Button size="sm" onClick={() => void mic.acquire()} className="bg-amber-500 hover:bg-amber-400 text-slate-900 shrink-0">
        Reconectar micrófono
      </Button>
    </div>
  );
};

/** A reload or an error: the interview cannot resume, but it can be finished. */
export const InterruptedPanel = ({ onFinish }: { onFinish: () => void }) => (
  <div className="w-full flex flex-col items-center gap-5 text-center">
    <TriangleAlertIcon className="size-10 text-amber-400" />
    <div>
      <h2 className="text-xl font-semibold text-slate-100">La entrevista se interrumpió</h2>
      <p className="text-sm text-slate-400 mt-1">
        No es posible reanudarla. Puedes finalizarla y generar el reporte con las respuestas que ya se registraron.
      </p>
    </div>
    <Button onClick={onFinish} className="bg-blue-600 hover:bg-blue-500 gap-2">
      <CheckIcon className="size-4" />
      Finalizar y generar reporte
    </Button>
  </div>
);

/** After the 10 questions: answer the skipped ones or finish. */
export const ReviewPanel = ({
  unanswered,
  onDecide,
}: {
  unanswered: QuestionRecord[];
  onDecide: (decision: "answer" | "finish") => void;
}) => (
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
      <Button onClick={() => onDecide("answer")} className="bg-blue-600 hover:bg-blue-500 gap-2">
        <MicIcon className="size-4" />
        Responder preguntas pendientes
      </Button>
      <Button
        variant="ghost"
        className="text-slate-400 hover:text-slate-200 gap-2"
        onClick={() => onDecide("finish")}
      >
        <CheckIcon className="size-4" />
        Finalizar entrevista
      </Button>
    </div>
  </div>
);
