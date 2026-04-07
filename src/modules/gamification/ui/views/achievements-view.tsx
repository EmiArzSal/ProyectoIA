"use client";

import { useTRPC } from "@/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { TrophyIcon } from "lucide-react";
import { ACHIEVEMENTS, CATEGORY_LABELS, type AchievementCategory } from "@/lib/achievements";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const CATEGORY_ORDER: AchievementCategory[] = ["sessions", "streak", "level", "performance"];

const CATEGORY_COLORS: Record<AchievementCategory, string> = {
  sessions:    "bg-blue-50 border-blue-200 text-blue-700",
  streak:      "bg-orange-50 border-orange-200 text-orange-700",
  level:       "bg-emerald-50 border-emerald-200 text-emerald-700",
  performance: "bg-violet-50 border-violet-200 text-violet-700",
};

export function AchievementsView() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: achievements = [] } = useQuery(trpc.gamification.getAchievements.queryOptions());
  const { data: stats } = useQuery(trpc.gamification.getStats.queryOptions());
  const markSeen = useMutation(trpc.gamification.markAllSeen.mutationOptions());

  // Mark all as seen on mount
  useEffect(() => {
    markSeen.mutate(undefined, {
      onSuccess: () => {
        queryClient.invalidateQueries(trpc.gamification.getUnseen.queryOptions());
      },
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const earnedCount = achievements.filter((a) => a.earned).length;

  return (
    <div className="flex-1 py-6 px-4 md:px-8 flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-amber-100">
            <TrophyIcon className="size-5 text-amber-600" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Logros</h1>
            <p className="text-sm text-muted-foreground">
              {earnedCount} de {ACHIEVEMENTS.length} desbloqueados
            </p>
          </div>
        </div>

        {/* Streak card */}
        {stats && (
          <div className="flex items-center gap-4 bg-orange-50 border border-orange-200 rounded-xl px-5 py-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-orange-500">🔥 {stats.currentStreak}</p>
              <p className="text-xs text-orange-600 font-medium">Racha actual</p>
            </div>
            <div className="w-px h-10 bg-orange-200" />
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-500">{stats.longestStreak}</p>
              <p className="text-xs text-amber-600 font-medium">Mejor racha</p>
            </div>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Progreso general</span>
          <span>{Math.round((earnedCount / ACHIEVEMENTS.length) * 100)}%</span>
        </div>
        <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500 rounded-full transition-all duration-700"
            style={{ width: `${(earnedCount / ACHIEVEMENTS.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Achievements by category */}
      {CATEGORY_ORDER.map((category) => {
        const items = achievements.filter((a) => a.category === category);
        return (
          <div key={category} className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
              {CATEGORY_LABELS[category]}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {items.map((a) => (
                <div
                  key={a.id}
                  className={cn(
                    "rounded-xl border p-4 flex gap-3 transition-all",
                    a.earned
                      ? CATEGORY_COLORS[a.category as AchievementCategory]
                      : "bg-gray-50 border-gray-200 opacity-50 grayscale"
                  )}
                >
                  <span className="text-3xl shrink-0">{a.emoji}</span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold">{a.title}</p>
                      {!a.earned && (
                        <Badge variant="outline" className="text-[10px] text-gray-400 border-gray-300">
                          Bloqueado
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 leading-relaxed opacity-80">{a.description}</p>
                    {a.earned && a.earnedAt && (
                      <p className="text-[10px] mt-1 opacity-60">
                        {format(new Date(a.earnedAt), "d MMM yyyy", { locale: es })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
