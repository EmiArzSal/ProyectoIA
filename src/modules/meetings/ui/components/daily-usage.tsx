"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarClockIcon } from "lucide-react";
import { useTRPC } from "@/trpc/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const useDailyUsage = () => {
  const trpc = useTRPC();
  return useQuery(trpc.meetings.getDailyUsage.queryOptions());
};

type Usage = NonNullable<ReturnType<typeof useDailyUsage>["data"]>;

/** True when the user cannot start another interview today. */
export const isBlocked = (usage: Usage | undefined) =>
  !!usage && (usage.remaining <= 0 || usage.globalExhausted);

/** Explanation to show when the user cannot start an interview, or null. */
export const blockedMessage = (usage: Usage | undefined): string | null => {
  if (!usage) return null;
  if (usage.remaining <= 0) {
    return `Ya usaste tus ${usage.limit} entrevistas de hoy. Podrás practicar de nuevo a partir de medianoche.`;
  }
  if (usage.globalExhausted) {
    return "La plataforma alcanzó su límite de entrevistas por hoy. Intenta mañana.";
  }
  return null;
};

export const DailyUsageBadge = ({ className }: { className?: string }) => {
  const { data } = useDailyUsage();
  if (!data) return null;

  const blocked = isBlocked(data);
  return (
    <Badge
      variant="outline"
      title="El contador se reinicia a medianoche (hora del centro de México)"
      className={cn(
        "gap-1.5 text-xs font-medium [&>svg]:size-3.5",
        blocked ? "border-red-200 bg-red-50 text-red-700" : "text-muted-foreground",
        className,
      )}
    >
      <CalendarClockIcon />
      {data.globalExhausted
        ? "Límite diario de la plataforma alcanzado"
        : `Te quedan ${data.remaining} de ${data.limit} entrevistas hoy`}
    </Badge>
  );
};
