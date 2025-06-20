"use client";

import { DataTable } from "@/components/data-table";
import { EmptyState } from "@/components/empty-state";
import { ErrorState } from "@/components/error-state";
import { LoadingState } from "@/components/loading-state";
import { columns } from "../components/columns";
import { useTRPC } from "@/trpc/client";
import { useSuspenseQuery } from "@tanstack/react-query";

export const MeetingsView = () => {
  const trpc = useTRPC(); 
  const { data } = useSuspenseQuery(trpc.meetings.getMany.queryOptions({}));
  return (
    <div className="flex-1 pb-4 px-4 md:px-8 flex flex-col gap-y-4">
      <DataTable
        data={data.items}
        columns={columns}
        onRowClick={() => {}} 
      />
      {data.items.length === 0 &&(
        <EmptyState
        title="Crea tu primera sesión"
        description="Programa una sesión con un agente. Cada sesión te permitirá practicar tus habilidades."
        />

      )}
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