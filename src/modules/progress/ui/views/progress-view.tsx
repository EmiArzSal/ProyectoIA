"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { ArrowRightIcon, TargetIcon } from "lucide-react";

import { useTRPC } from "@/trpc/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import type { TopicProgressItem, TopicStatus } from "@/modules/progress/server/procedures";

const STATUS: Record<TopicStatus, { label: string; badge: string; card: string }> = {
  new:      { label: "Sin practicar", badge: "bg-gray-100 text-gray-500 border-gray-200",          card: "border-gray-200 bg-gray-50/60" },
  weak:     { label: "Por reforzar",  badge: "bg-red-50 text-red-700 border-red-200",              card: "border-red-200 bg-white" },
  progress: { label: "En progreso",   badge: "bg-blue-50 text-blue-700 border-blue-200",           card: "border-gray-200 bg-white" },
  mastered: { label: "Dominado",      badge: "bg-emerald-50 text-emerald-700 border-emerald-200",  card: "border-emerald-200 bg-white" },
};

const LEVEL_LABELS = ["Concepto", "Comparar", "Aplicar"];

const scoreColor = (score: number | null) =>
  score === null ? "bg-gray-200" : score <= 2 ? "bg-red-400" : score === 3 ? "bg-amber-400" : "bg-emerald-500";

// ── Pieces ────────────────────────────────────────────────────────────────────

function LevelSteps({ level }: { level: number }) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex gap-1">
        {[1, 2, 3].map((n) => (
          <span key={n} className={cn("h-1.5 flex-1 rounded-full", n <= level ? "bg-violet-500" : "bg-gray-200")} />
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground">
        Nivel {level} · {LEVEL_LABELS[level - 1]}
      </p>
    </div>
  );
}

function ScoreHistory({ history }: { history: (number | null)[] }) {
  if (history.length === 0) return null;
  return (
    <div className="flex items-center gap-1" aria-label="Últimas calificaciones">
      {history.map((score, i) => (
        <span
          key={i}
          title={score === null ? "Sin respuesta" : `${score}/5`}
          className={cn(
            "size-5 rounded-full text-[10px] font-semibold text-white flex items-center justify-center",
            scoreColor(score),
          )}
        >
          {score ?? "–"}
        </span>
      ))}
    </div>
  );
}

function TopicCard({ topic, showLevel }: { topic: TopicProgressItem; showLevel: boolean }) {
  const status = STATUS[topic.status];
  return (
    <div className={cn("rounded-xl border p-4 flex flex-col gap-3", status.card)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold leading-snug">{topic.title}</p>
        <Badge variant="outline" className={cn("shrink-0 text-[10px]", status.badge)}>
          {status.label}
        </Badge>
      </div>

      {showLevel && topic.attempts > 0 && <LevelSteps level={topic.level} />}

      {topic.attempts > 0 ? (
        <div className="flex items-end justify-between gap-2">
          <div className="text-xs text-muted-foreground leading-relaxed">
            <p>
              Última: <span className="font-medium text-foreground">{topic.lastScore}/5</span>
              {topic.bestScore !== null && <> · Mejor: <span className="font-medium text-foreground">{topic.bestScore}/5</span></>}
            </p>
            <p>
              {topic.attempts} {topic.attempts === 1 ? "vez" : "veces"}
              {topic.lastPracticedAt && (
                <> · {formatDistanceToNow(new Date(topic.lastPracticedAt), { addSuffix: true, locale: es })}</>
              )}
            </p>
          </div>
          <ScoreHistory history={topic.history} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Aparecerá en tus próximas entrevistas.</p>
      )}
    </div>
  );
}

// ── View ──────────────────────────────────────────────────────────────────────

export function ProgressView() {
  const trpc = useTRPC();
  const { data, isPending, isError } = useQuery(trpc.progress.getOverview.queryOptions());

  const summary = useMemo(() => {
    if (!data) return null;
    const tech = data.roles.flatMap((r) => r.topics.map((t) => ({ ...t, role: r.role, agentId: r.agentId as string | null })));
    const soft = data.softSkills.map((t) => ({ ...t, role: "Soft skills", agentId: null as string | null }));
    const all = [...tech, ...soft];
    const practiced = all.filter((t) => t.attempts > 0);

    // Default tab: the role practiced the most.
    const defaultRole = [...data.roles].sort(
      (a, b) => b.topics.filter((t) => t.attempts > 0).length - a.topics.filter((t) => t.attempts > 0).length,
    )[0]?.agentId;

    return {
      total: all.length,
      practiced: practiced.length,
      mastered: all.filter((t) => t.status === "mastered").length,
      weak: all
        .filter((t) => t.status === "weak")
        .sort((a, b) => (a.lastScore ?? 0) - (b.lastScore ?? 0))
        .slice(0, 6),
      defaultRole,
    };
  }, [data]);

  if (isPending) {
    return <LoadingState title="Cargando tu progreso" description="Esto puede tomar unos segundos" />;
  }
  if (isError || !data || !summary) {
    return <ErrorState title="Error al cargar tu progreso" description="Intenta de nuevo más tarde" />;
  }

  return (
    <div className="flex-1 py-6 px-4 md:px-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-100">
            <TargetIcon className="size-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Progreso por tema</h1>
            <p className="text-sm text-muted-foreground">
              {summary.practiced} de {summary.total} temas practicados · {summary.mastered} dominados
            </p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground max-w-sm">
          Cada tema tiene 3 niveles: <strong>Concepto</strong>, <strong>Comparar</strong> y <strong>Aplicar</strong>.
          Con 4/5 o más subes de nivel; con 2/5 o menos, el tema vuelve pronto para reforzarlo.
        </p>
      </div>

      {/* Empty state */}
      {summary.practiced === 0 && (
        <div className="rounded-xl border border-dashed p-6 flex flex-col items-center gap-3 text-center">
          <p className="text-sm font-medium">Aún no tienes progreso registrado</p>
          <p className="text-sm text-muted-foreground max-w-md">
            Completa una entrevista y aquí verás cómo te fue en cada tema, cuáles dominas y cuáles conviene reforzar.
          </p>
          <Button size="sm" nativeButton={false} render={<Link href="/agentes" />}>
            Elegir entrevistador
            <ArrowRightIcon className="size-4" />
          </Button>
        </div>
      )}

      {/* Topics to reinforce */}
      {summary.weak.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Para reforzar</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {summary.weak.map((t) => (
              <div key={t.id} className="rounded-xl border border-red-200 bg-red-50/50 p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{t.title}</p>
                  <p className="text-xs text-muted-foreground">{t.role} · última {t.lastScore}/5</p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  nativeButton={false}
                  render={<Link href={t.agentId ? `/agentes/${t.agentId}` : "/agentes"} />}
                >
                  Practicar
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Topics by interviewer */}
      <Tabs defaultValue={summary.defaultRole ?? data.roles[0].agentId} className="gap-4">
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList>
            {data.roles.map((r) => (
              <TabsTrigger key={r.agentId} value={r.agentId} className="text-xs sm:text-sm">
                {r.role}
                <span className="ml-1 text-muted-foreground">
                  {r.topics.filter((t) => t.attempts > 0).length}/{r.topics.length}
                </span>
              </TabsTrigger>
            ))}
            <TabsTrigger value="soft" className="text-xs sm:text-sm">
              Soft skills
              <span className="ml-1 text-muted-foreground">
                {data.softSkills.filter((t) => t.attempts > 0).length}/{data.softSkills.length}
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {data.roles.map((r) => (
          <TabsContent key={r.agentId} value={r.agentId}>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {r.topics.map((t) => <TopicCard key={t.id} topic={t} showLevel />)}
            </div>
          </TabsContent>
        ))}
        <TabsContent value="soft">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {data.softSkills.map((t) => <TopicCard key={t.id} topic={t} showLevel={false} />)}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
