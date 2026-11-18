"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckIcon, RotateCcwIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReviewGrade } from "@/modules/glossary/review";
import { useTRPC } from "@/trpc/client";

export type ReviewCard = {
  id: string;
  term: string;
  definition: string;
  note: string | null;
  source: string;
};

const GRADES: { grade: ReviewGrade; label: string; key: string; className: string }[] = [
  { grade: "again", label: "No me la sé", key: "1", className: "border-red-200 text-red-700 hover:bg-red-50" },
  { grade: "hard",  label: "Más o menos", key: "2", className: "border-amber-200 text-amber-700 hover:bg-amber-50" },
  { grade: "good",  label: "Me la sé",    key: "3", className: "border-emerald-200 text-emerald-700 hover:bg-emerald-50" },
];

/** The faces of a card: a term and its definition, or a sentence and its correction. */
export const cardLabels = (source: string) =>
  source === "correction"
    ? { front: "Tu frase", back: "Corrección", hint: "¿Cómo lo dirías correctamente?" }
    : { front: "Término", back: "Definición", hint: "¿Qué significa?" };

/**
 * One card at a time: flip it, say how well you knew it, next. A card you
 * did not know comes back once at the end of the session (it is also due
 * again today).
 */
export function ReviewSession({ cards, total, onClose }: { cards: ReviewCard[]; total: number; onClose: () => void }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [queue, setQueue]       = useState(cards);
  const [index, setIndex]       = useState(0);
  const [flipped, setFlipped]   = useState(false);
  const [repeated, setRepeated] = useState<Set<string>>(new Set());
  const [tally, setTally]       = useState<Record<ReviewGrade, number>>({ again: 0, hard: 0, good: 0 });

  const review = useMutation(trpc.glossary.review.mutationOptions({
    onError: () => toast.error("No se pudo guardar tu repaso de esta tarjeta."),
  }));

  const card = queue[index];
  const finished = index >= queue.length;

  const close = () => {
    void queryClient.invalidateQueries(trpc.glossary.getMany.queryOptions());
    void queryClient.invalidateQueries(trpc.glossary.getReviewQueue.queryOptions());
    onClose();
  };

  const grade = (g: ReviewGrade) => {
    if (!card || !flipped) return;
    review.mutate({ id: card.id, grade: g });
    // Count each card once, by its first answer.
    if (!repeated.has(card.id)) setTally((t) => ({ ...t, [g]: t[g] + 1 }));
    if (g === "again" && !repeated.has(card.id)) {
      setQueue((q) => [...q, card]);
      setRepeated((r) => new Set(r).add(card.id));
    }
    setFlipped(false);
    setIndex((i) => i + 1);
  };

  // Space/Enter flips, 1–3 grade, Esc leaves.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("input, textarea")) return;
      if (e.key === "Escape") { close(); return; }
      if (finished) return;
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); setFlipped((f) => !f); return; }
      const g = GRADES.find((x) => x.key === e.key);
      if (g) grade(g.grade);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (finished) {
    const reviewed = cards.length;
    const left = Math.max(0, total - reviewed);
    return (
      <div className="rounded-xl border bg-white p-8 flex flex-col items-center gap-4 text-center">
        <div className="p-3 rounded-full bg-emerald-50">
          <CheckIcon className="size-6 text-emerald-600" />
        </div>
        <div>
          <p className="text-lg font-semibold">Repaso terminado</p>
          <p className="text-sm text-muted-foreground mt-1">
            Repasaste {reviewed} {reviewed === 1 ? "tarjeta" : "tarjetas"}: {tally.good} me la sé · {tally.hard} más o menos · {tally.again} no me la sé.
          </p>
          {left > 0 && (
            <p className="text-sm text-muted-foreground mt-1">Te quedan {left} para hoy.</p>
          )}
        </div>
        <Button size="sm" onClick={close}>Volver a mis tarjetas</Button>
      </div>
    );
  }

  const labels = cardLabels(card.source);
  const position = Math.min(index + 1, queue.length);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground tabular-nums">
          Tarjeta {position} de {queue.length}
          {repeated.has(card.id) && index >= cards.length && <span className="ml-2 text-amber-700">· otra vez</span>}
        </p>
        <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground" onClick={close}>
          <XIcon className="size-4" /> Salir
        </Button>
      </div>

      <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="h-64 w-full max-w-xl mx-auto text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-xl"
        style={{ perspective: "1000px" }}
        aria-label={flipped ? "Ver el frente de la tarjeta" : "Voltear la tarjeta"}
      >
        <div
          className="relative w-full h-full transition-transform duration-500"
          style={{ transformStyle: "preserve-3d", transform: flipped ? "rotateY(180deg)" : "none" }}
        >
          <Face label={labels.front} hint={`${labels.hint} Toca o pulsa espacio para voltear.`}>
            <p className="text-lg font-semibold text-gray-800 text-center leading-snug break-words">{card.term}</p>
          </Face>
          <Face label={labels.back} back>
            <p className="text-lg font-semibold text-gray-800 text-center leading-snug break-words">{card.definition}</p>
            {card.note && <p className="text-xs text-muted-foreground text-center leading-relaxed mt-2">{card.note}</p>}
          </Face>
        </div>
      </button>

      <div className="flex flex-wrap justify-center gap-2 min-h-9">
        {flipped ? (
          GRADES.map((g) => (
            <Button key={g.grade} variant="outline" size="sm" className={cn("gap-2", g.className)} onClick={() => grade(g.grade)}>
              {g.label}
              <kbd className="text-[10px] text-muted-foreground">{g.key}</kbd>
            </Button>
          ))
        ) : (
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setFlipped(true)}>
            <RotateCcwIcon className="size-3.5" /> Voltear
          </Button>
        )}
      </div>
    </div>
  );
}

function Face({ label, hint, back, children }: { label: string; hint?: string; back?: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "absolute inset-0 rounded-xl border flex flex-col items-center justify-center gap-2 p-6 shadow-sm select-none",
        back ? "bg-primary/5 border-primary/20" : "bg-white",
      )}
      style={{
        backfaceVisibility: "hidden",
        WebkitBackfaceVisibility: "hidden",
        transform: back ? "rotateY(180deg) translateZ(0.1px)" : "translateZ(0.1px)",
      }}
    >
      <p className={cn("text-[10px] font-semibold uppercase tracking-widest", back ? "text-primary/70" : "text-muted-foreground")}>
        {label}
      </p>
      {children}
      {hint && <p className="text-[11px] text-muted-foreground mt-2 text-center">{hint}</p>}
    </div>
  );
}
