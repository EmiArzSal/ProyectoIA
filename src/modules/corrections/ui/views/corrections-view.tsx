"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { BookMarkedIcon, Trash2Icon, AlertCircleIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { CorrectionType } from "@/db/schema";

// ── Helpers ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<CorrectionType, string> = {
  grammar: "Gramática",
  vocabulary: "Vocabulario",
  technical: "Técnico",
};

const TYPE_COLORS: Record<CorrectionType, string> = {
  grammar: "bg-red-100 text-red-700 border-red-200",
  vocabulary: "bg-violet-100 text-violet-700 border-violet-200",
  technical: "bg-blue-100 text-blue-700 border-blue-200",
};

type FilterTab = "all" | CorrectionType;

// ── Card ─────────────────────────────────────────────────────────────────────

function CorrectionCard({
  id,
  original,
  corrected,
  type,
  note,
  meetingName,
  createdAt,
  onRemove,
}: {
  id: string;
  original: string;
  corrected: string;
  type: CorrectionType;
  note: string;
  meetingName: string | null;
  createdAt: Date;
  onRemove: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border bg-white p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="outline" className={cn("text-xs font-semibold", TYPE_COLORS[type])}>
            {TYPE_LABELS[type]}
          </Badge>
          {meetingName && (
            <span className="text-xs text-muted-foreground truncate max-w-[180px]">
              · {meetingName}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 shrink-0 text-muted-foreground hover:text-red-500"
          onClick={() => onRemove(id)}
        >
          <Trash2Icon className="size-3.5" />
        </Button>
      </div>

      {/* Original → Corrected */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm font-medium text-gray-800 line-through decoration-red-400">
          {original}
        </span>
        <span className="text-muted-foreground text-xs">→</span>
        <span className="text-sm font-semibold text-emerald-700">
          {corrected}
        </span>
      </div>

      {/* Note */}
      <p className="text-xs text-muted-foreground leading-relaxed">{note}</p>

      <p className="text-xs text-gray-400">
        {format(new Date(createdAt), "d 'de' MMMM yyyy", { locale: es })}
      </p>
    </div>
  );
}

// ── Main view ─────────────────────────────────────────────────────────────────

export function CorrectionsView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<FilterTab>("all");

  const queryKey = activeTab === "all" ? {} : { type: activeTab as CorrectionType };

  const { data = [], isLoading } = useQuery(
    trpc.corrections.getMany.queryOptions(queryKey)
  );

  const remove = useMutation(
    trpc.corrections.remove.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.corrections.getMany.queryOptions({}));
        queryClient.invalidateQueries(trpc.corrections.getMany.queryOptions({ type: "grammar" }));
        queryClient.invalidateQueries(trpc.corrections.getMany.queryOptions({ type: "vocabulary" }));
        queryClient.invalidateQueries(trpc.corrections.getMany.queryOptions({ type: "technical" }));
      },
    })
  );

  const removeAll = useMutation(
    trpc.corrections.removeAll.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.corrections.getMany.queryOptions({}));
        queryClient.invalidateQueries(trpc.corrections.getMany.queryOptions({ type: "grammar" }));
        queryClient.invalidateQueries(trpc.corrections.getMany.queryOptions({ type: "vocabulary" }));
        queryClient.invalidateQueries(trpc.corrections.getMany.queryOptions({ type: "technical" }));
        toast.success("Entradas eliminadas.");
      },
    })
  );

  const handleRemove = (id: string) => {
    remove.mutate({ id });
  };

  const handleClearTab = () => {
    if (!confirm("¿Eliminar todas las entradas de esta categoría?")) return;
    removeAll.mutate(activeTab === "all" ? {} : { type: activeTab as CorrectionType });
  };

  const tabs: { value: FilterTab; label: string }[] = [
    { value: "all", label: "Todas" },
    { value: "grammar", label: "Gramática" },
    { value: "vocabulary", label: "Vocabulario" },
    { value: "technical", label: "Técnico" },
  ];

  return (
    <div className="flex-1 py-6 px-4 md:px-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <BookMarkedIcon className="size-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Mi Glosario</h1>
            <p className="text-sm text-muted-foreground">
              Correcciones acumuladas de tus entrevistas de práctica
            </p>
          </div>
        </div>
        {data.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-600 hover:bg-red-50 gap-1.5 text-xs"
            onClick={handleClearTab}
            disabled={removeAll.isPending}
          >
            <Trash2Icon className="size-3.5" />
            Limpiar {activeTab === "all" ? "todo" : TYPE_LABELS[activeTab as CorrectionType].toLowerCase()}
          </Button>
        )}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as FilterTab)}>
        <TabsList className="rounded-none bg-transparent border-b w-full justify-start h-auto p-0 gap-0">
          {tabs.map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-none bg-transparent data-[state=active]:shadow-none border-b-2 border-transparent data-[state=active]:border-b-primary text-muted-foreground data-[state=active]:text-foreground h-10 px-4 text-sm"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {tabs.map(({ value }) => (
          <TabsContent key={value} value={value} className="mt-6">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="rounded-xl border bg-white p-4 h-32 animate-pulse" />
                ))}
              </div>
            ) : data.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
                <AlertCircleIcon className="size-10 text-muted-foreground/40" />
                <p className="text-muted-foreground text-sm">
                  Aún no hay entradas en tu glosario.<br />
                  Completa una entrevista para ver tus correcciones aquí.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.map((c) => (
                  <CorrectionCard
                    key={c.id}
                    {...c}
                    createdAt={new Date(c.createdAt)}
                    type={c.type as CorrectionType}
                    onRemove={handleRemove}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
