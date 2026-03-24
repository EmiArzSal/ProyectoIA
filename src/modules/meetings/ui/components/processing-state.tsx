"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/trpc/client";
import { EmptyState } from "@/components/empty-state";
import { LoaderIcon } from "lucide-react";

interface Props {
  meetingId: string;
}

export const ProcessingState = ({ meetingId }: Props) => {
  const queryClient = useQueryClient();
  const trpc = useTRPC();

  // Poll every 5 s until the summary is ready
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries(
        trpc.meetings.getOne.queryOptions({ id: meetingId })
      );
    }, 5000);
    return () => clearInterval(interval);
  }, [meetingId, queryClient, trpc]);

  return (
    <div className="bg-white rounded-lg px-4 py-5 flex flex-col gap-y-8 items-center justify-center">
      <EmptyState
        image="/processing.svg"
        title="Generando resumen"
        description="Estamos analizando tu entrevista y preparando la retroalimentación. Esto toma menos de un minuto."
      />
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderIcon className="animate-spin size-4" />
        La página se actualizará automáticamente...
      </div>
    </div>
  );
};
