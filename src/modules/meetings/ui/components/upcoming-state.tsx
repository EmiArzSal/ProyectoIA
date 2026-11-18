"use client";

import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { VideoIcon } from "lucide-react";
import { MAX_SESSION_MINUTES, TOTAL_QUESTIONS } from "@/modules/call/constants";
import { blockedMessage, DailyUsageBadge, isBlocked, useDailyUsage } from "./daily-usage";

interface Props {
  meetingId: string;
}

export const UpcomingState = ({ meetingId }: Props) => {
  const { data: usage, isPending } = useDailyUsage();
  const blocked = isPending || isBlocked(usage);

  return (
    <div className="bg-white rounded-lg px-4 py-5 flex flex-col gap-y-8 items-center justify-center">
        <EmptyState
        image="/upcoming.svg"
        title="Entrevista lista para comenzar"
        description={`${TOTAL_QUESTIONS} preguntas, máximo ${MAX_SESSION_MINUTES} minutos. Primero probarás tu micrófono; el tiempo empieza cuando inicies la entrevista.`}
        />
      <div className="flex flex-col gap-3 items-center w-full">
        <DailyUsageBadge />
        {blocked ? (
          <>
            <Button variant="default" className="w-full lg:w-auto" disabled>
              <VideoIcon/>
              Iniciar entrevista
            </Button>
            <p className="text-sm text-muted-foreground text-center">{blockedMessage(usage)}</p>
          </>
        ) : (
          <Button variant="default" className="w-full lg:w-auto" nativeButton={false} render={<Link href={`/call/${meetingId}`} />}>
              <VideoIcon/>
              Iniciar entrevista
          </Button>
        )}
      </div>
    </div>
  );
};
