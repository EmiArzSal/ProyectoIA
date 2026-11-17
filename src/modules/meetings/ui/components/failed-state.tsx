"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RotateCwIcon } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/trpc/client";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";

interface Props {
  meetingId: string;
}

export const FailedState = ({ meetingId }: Props) => {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const retry = useMutation(
    trpc.meetings.retryProcessing.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(trpc.meetings.getOne.queryOptions({ id: meetingId }));
        await queryClient.invalidateQueries(trpc.meetings.getMany.queryOptions({}));
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <div className="bg-white rounded-lg px-4 py-5 flex flex-col gap-y-6 items-center justify-center">
      <EmptyState
        image="/cancelled.svg"
        title="No pudimos generar tu reporte"
        description="Tus respuestas están guardadas. Hubo un problema al evaluarlas; puedes intentarlo de nuevo."
      />
      <Button onClick={() => retry.mutate({ id: meetingId })} disabled={retry.isPending}>
        <RotateCwIcon className={retry.isPending ? "animate-spin" : undefined} />
        {retry.isPending ? "Reintentando..." : "Reintentar evaluación"}
      </Button>
    </div>
  );
};
