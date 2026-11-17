"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { LoaderIcon, RefreshCwIcon } from "lucide-react";

interface Props {
  meetingId: string;
}

const POLL_MS = 5_000;
// The job normally takes under a minute. Retries can take longer, so stop
// polling after this and let the user check again on demand.
const MAX_WAIT_MS = 3 * 60_000;

export const ProcessingState = ({ meetingId }: Props) => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();
  const [round, setRound] = useState(0);   // bump to start a new waiting window
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    setTimedOut(false);
    const started = Date.now();
    const refresh = () =>
      queryClient.invalidateQueries(trpc.meetings.getOne.queryOptions({ id: meetingId }));
    if (round > 0) refresh(); // "Volver a comprobar" checks right away

    const interval = setInterval(() => {
      if (Date.now() - started >= MAX_WAIT_MS) {
        clearInterval(interval);
        setTimedOut(true);
        return;
      }
      refresh();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [meetingId, queryClient, trpc, round]);

  return (
    <div className="bg-white rounded-lg px-4 py-5 flex flex-col gap-y-8 items-center justify-center">
      <EmptyState
        image="/processing.svg"
        title="Generando resumen"
        description="Estamos analizando tu entrevista y preparando la retroalimentación. Esto toma menos de un minuto."
      />
      {timedOut ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <p className="text-sm text-muted-foreground max-w-md">
            Está tardando más de lo normal. Seguimos intentándolo en segundo plano; si algo falla,
            aquí aparecerá la opción de reintentar.
          </p>
          <Button variant="outline" size="sm" onClick={() => setRound((r) => r + 1)}>
            <RefreshCwIcon />
            Volver a comprobar
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderIcon className="animate-spin size-4" />
          La página se actualizará automáticamente...
        </div>
      )}
    </div>
  );
};
