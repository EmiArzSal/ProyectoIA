"use client";

import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

export const MeetingsView = () => {
  const trpc = useTRPC();
  const { data } = useSuspenseQuery(trpc.meetings.getMany.queryOptions({}));
  return (
    <div>
      Hola
      {/* {JSON.stringify(data)} */}
    </div>
  );
};

export const MeetingsViewLoading = () => {
  return (
      <LoadingState
        title="Cargando sesiones"
        description="Esto puede tomar unos segundos"
      />
    
  );
};

export const MeetingsViewError = () => {
  return (
      <ErrorState
          title="Error al cargar sesiones"
          description="Intenta de nuevo más tarde"
        />
  );
};