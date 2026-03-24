"use client";

import { MeetingGetOne } from "../../types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  BookOpenTextIcon,
  FileTextIcon,
  CheckCircle2Icon,
  XCircleIcon,
  ChevronDownIcon,
} from "lucide-react";
import { GeneratedAvatar } from "@/components/ui/generated-avatar";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { formatDuration } from "@/lib/utils";
import { Transcript } from "./transcript";
import { cn } from "@/lib/utils";
import type { InterviewReport, AnnotatedSegment } from "@/lib/generate-summary";
import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseReport(summary: string | null | undefined): InterviewReport | null {
  if (!summary) return null;
  try {
    return JSON.parse(summary) as InterviewReport;
  } catch {
    return null;
  }
}

const CEFR_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"];

function cefrColor(level: string) {
  const idx = CEFR_ORDER.indexOf(level);
  if (idx <= 1) return "bg-red-100 text-red-700 border-red-200";
  if (idx === 2) return "bg-amber-100 text-amber-700 border-amber-200";
  if (idx === 3) return "bg-blue-100 text-blue-700 border-blue-200";
  return "bg-emerald-100 text-emerald-700 border-emerald-200";
}

function scoreColor(score: number) {
  if (score <= 2) return "text-red-500";
  if (score === 3) return "text-amber-500";
  return "text-emerald-600";
}

function scoreBg(score: number) {
  if (score <= 2) return "bg-red-500";
  if (score === 3) return "bg-amber-400";
  return "bg-emerald-500";
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreDots({ score, max = 5 }: { score: number; max?: number }) {
  return (
    <div className="flex gap-1">
      {Array.from({ length: max }).map((_, i) => (
        <span
          key={i}
          className={cn(
            "size-2.5 rounded-full",
            i < score ? scoreBg(score) : "bg-gray-200"
          )}
        />
      ))}
    </div>
  );
}

function ScoreCard({
  label,
  score,
  cefrLevel,
  notes,
}: {
  label: string;
  score: number;
  cefrLevel?: string;
  notes: string;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {cefrLevel && cefrLevel !== "—" && (
          <Badge variant="outline" className={cn("text-xs font-semibold", cefrColor(cefrLevel))}>
            {cefrLevel}
          </Badge>
        )}
      </div>
      <div className="flex items-center gap-3">
        <ScoreDots score={score} />
        <span className={cn("text-sm font-bold", scoreColor(score))}>
          {score}/5
        </span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{notes}</p>
    </div>
  );
}

// ── Annotation colors ─────────────────────────────────────────────────────────

const ANNOTATION_UNDERLINE: Record<string, string> = {
  grammar: "underline decoration-red-400 decoration-wavy cursor-pointer",
  vocabulary: "underline decoration-violet-400 decoration-dotted cursor-pointer",
  technical: "underline decoration-blue-400 decoration-dashed cursor-pointer",
};

const ANNOTATION_BADGE: Record<string, string> = {
  grammar: "bg-red-100 text-red-700 border-red-200",
  vocabulary: "bg-violet-100 text-violet-700 border-violet-200",
  technical: "bg-blue-100 text-blue-700 border-blue-200",
};

const ANNOTATION_TYPE_LABEL: Record<string, string> = {
  grammar: "Gramática",
  vocabulary: "Vocabulario",
  technical: "Técnico",
};

function AnnotatedAnswer({ segments }: { segments: AnnotatedSegment[] }) {
  if (!segments || segments.length === 0) return null;

  return (
    <p className="text-sm text-gray-700 leading-relaxed italic">
      {segments.map((seg, i) => {
        if (!seg.annotation) {
          return <span key={i}>{seg.text}</span>;
        }
        return (
          <Popover key={i}>
            <PopoverTrigger asChild>
              <span className={cn("not-italic font-medium", ANNOTATION_UNDERLINE[seg.annotation.type])}>
                {seg.text}
              </span>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-3 text-sm" side="top">
              <div className="flex flex-col gap-2">
                <Badge
                  variant="outline"
                  className={cn("text-xs self-start", ANNOTATION_BADGE[seg.annotation.type])}
                >
                  {ANNOTATION_TYPE_LABEL[seg.annotation.type]}
                </Badge>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="line-through text-gray-500 text-xs">{seg.text}</span>
                  <span className="text-gray-400 text-xs">→</span>
                  <span className="font-semibold text-emerald-700 text-xs">{seg.annotation.corrected}</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{seg.annotation.note}</p>
              </div>
            </PopoverContent>
          </Popover>
        );
      })}
    </p>
  );
}

function QuestionItem({ q, index }: { q: InterviewReport["questions"][number]; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors text-left gap-3"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="shrink-0 size-6 rounded-full bg-gray-100 text-gray-600 text-xs font-semibold flex items-center justify-center">
            {index + 1}
          </span>
          <span className="text-sm font-medium text-gray-800 truncate">{q.question}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ScoreDots score={q.technicalScore} />
          <ChevronDownIcon
            className={cn("size-4 text-gray-400 transition-transform", open && "rotate-180")}
          />
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 flex flex-col gap-3 border-t bg-gray-50/50">
          {/* User answer */}
          <div className="pt-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Tu respuesta</p>
            {q.userAnswerAnnotated && q.userAnswerAnnotated.length > 0 ? (
              <AnnotatedAnswer segments={q.userAnswerAnnotated} />
            ) : (
              <p className="text-sm text-gray-700 leading-relaxed italic">
                {q.userAnswer || <span className="text-gray-400 not-italic">Sin respuesta</span>}
              </p>
            )}
            {q.userAnswerAnnotated && q.userAnswerAnnotated.some(s => s.annotation) && (
              <div className="flex flex-wrap gap-2 mt-2">
                {[
                  { type: "grammar", label: "Gramática", cls: "bg-red-100 text-red-600" },
                  { type: "vocabulary", label: "Vocabulario", cls: "bg-violet-100 text-violet-600" },
                  { type: "technical", label: "Técnico", cls: "bg-blue-100 text-blue-600" },
                ]
                  .filter(({ type }) => q.userAnswerAnnotated.some(s => s.annotation?.type === type))
                  .map(({ type, label, cls }) => (
                    <span key={type} className={cn("text-[10px] font-medium px-2 py-0.5 rounded-full", cls)}>
                      {label}
                    </span>
                  ))}
                <span className="text-[10px] text-muted-foreground self-center">← toca una palabra subrayada</span>
              </div>
            )}
          </div>

          {/* Feedback */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Retroalimentación</p>
            <p className="text-sm text-gray-700 leading-relaxed">{q.feedback}</p>
          </div>

          {/* Strengths & improvements */}
          <div className="grid grid-cols-2 gap-3">
            {q.strengths.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-emerald-700 mb-1 flex items-center gap-1">
                  <CheckCircle2Icon className="size-3" /> Puntos positivos
                </p>
                <ul className="space-y-0.5">
                  {q.strengths.map((s, i) => (
                    <li key={i} className="text-xs text-gray-600">• {s}</li>
                  ))}
                </ul>
              </div>
            )}
            {q.improvements.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-amber-700 mb-1 flex items-center gap-1">
                  <XCircleIcon className="size-3" /> Por mejorar
                </p>
                <ul className="space-y-0.5">
                  {q.improvements.map((s, i) => (
                    <li key={i} className="text-xs text-gray-600">• {s}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props { data: MeetingGetOne }

export const CompletedState = ({ data }: Props) => {
  const report = parseReport(data.summary);

  return (
    <Tabs defaultValue="feedback">
      <div className="overflow-x-hidden">
        <TabsList className="rounded-none bg-transparent border-b w-full justify-start h-auto p-0 gap-0">
          {[
            { value: "feedback", icon: BookOpenTextIcon, label: "Retroalimentación" },
            { value: "transcript", icon: FileTextIcon, label: "Transcripción" },
          ].map(({ value, icon: Icon, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-none bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-b-primary text-muted-foreground data-[state=active]:text-foreground h-10 px-4 gap-1.5 text-sm"
            >
              <Icon className="size-4" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>
      </div>

      {/* ── Transcript tab ── */}
      <TabsContent value="transcript">
        <Transcript meetingId={data.id} />
      </TabsContent>

      {/* ── Feedback tab ── */}
      <TabsContent value="feedback" className="mt-0">
        {!report || !report.summary ? (
          <div className="bg-white rounded-xl border p-8 text-center text-muted-foreground text-sm">
            No hay retroalimentación disponible para esta entrevista .
          </div>
        ) : (
          <div className="flex flex-col gap-4">

            {/* ── Session header card ── */}
            <div className="bg-white rounded-xl border p-5 flex flex-col gap-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <GeneratedAvatar seed={data.agent.name} variant="botttsNeutral" className="size-12" />
                  <div>
                    <h2 className="font-semibold text-lg">{data.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {data.agent.role}
                      {data.startedAt && (
                        <> · {format(data.startedAt, "d 'de' MMMM yyyy", { locale: es })}</>
                      )}
                      {data.duration && <> · {formatDuration(data.duration)}</>}
                    </p>
                  </div>
                </div>
                {report.englishLevel && report.englishLevel !== "—" && (
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">Nivel general</span>
                    <Badge
                      variant="outline"
                      className={cn("text-base font-bold px-3 py-1", cefrColor(report.englishLevel))}
                    >
                      {report.englishLevel}
                    </Badge>
                  </div>
                )}
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{report.summary}</p>
            </div>

            {/* ── Score grid ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              <ScoreCard
                label="Gramática"
                score={report.scores.grammar.score}
                cefrLevel={report.scores.grammar.cefrLevel}
                notes={report.scores.grammar.notes}
              />
              <ScoreCard
                label="Vocabulario"
                score={report.scores.vocabulary.score}
                cefrLevel={report.scores.vocabulary.cefrLevel}
                notes={report.scores.vocabulary.notes}
              />
              <ScoreCard
                label="Fluidez"
                score={report.scores.fluency.score}
                cefrLevel={report.scores.fluency.cefrLevel}
                notes={report.scores.fluency.notes}
              />
              <ScoreCard
                label="Conocimiento técnico"
                score={report.scores.technicalKnowledge.score}
                notes={report.scores.technicalKnowledge.notes}
              />
            </div>

            {/* ── Question breakdown ── */}
            {report.questions.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-gray-700 px-1">
                  Desglose por pregunta
                </h3>
                {report.questions.map((q, i) => (
                  <QuestionItem key={i} q={q} index={i} />
                ))}
              </div>
            )}

            {/* ── Strengths & improvements ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {report.overallStrengths.length > 0 && (
                <div className="rounded-xl border bg-emerald-50 p-4 flex flex-col gap-2">
                  <p className="text-sm font-semibold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2Icon className="size-4" /> Puntos fuertes
                  </p>
                  <ul className="space-y-1.5">
                    {report.overallStrengths.map((s, i) => (
                      <li key={i} className="text-sm text-emerald-900 flex gap-2">
                        <span className="text-emerald-500 mt-0.5">✓</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {report.overallImprovements.length > 0 && (
                <div className="rounded-xl border bg-amber-50 p-4 flex flex-col gap-2">
                  <p className="text-sm font-semibold text-amber-800 flex items-center gap-1.5">
                    <XCircleIcon className="size-4" /> Áreas prioritarias de mejora
                  </p>
                  <ul className="space-y-1.5">
                    {report.overallImprovements.map((s, i) => (
                      <li key={i} className="text-sm text-amber-900 flex gap-2">
                        <span className="text-amber-500 mt-0.5">→</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* ── Recommendation ── */}
            {report.recommendation && (
              <div className="rounded-xl border bg-blue-50 border-blue-200 p-4">
                <p className="text-sm font-semibold text-blue-800 mb-1">Recomendación</p>
                <p className="text-sm text-blue-900 leading-relaxed">{report.recommendation}</p>
              </div>
            )}

          </div>
        )}
      </TabsContent>
    </Tabs>
  );
};
