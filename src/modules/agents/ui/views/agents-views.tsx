"use client";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useTRPC } from "@/trpc/client";
import { LoadingState } from "@/components/loading-state";
import { ErrorState } from "@/components/error-state";
import { EmptyState } from "@/components/empty-state";
import { DataTable } from "../components/data-table";
import { columns} from "../components/columns";
import { useAgentsFilters } from "../../hooks/use-agents-filters";
import { DataPagination } from "../components/data-pagination";
import { useRouter } from "next/navigation";

export const AgentsView = () => {
  const router = useRouter();
  const [filters, setFilters] = useAgentsFilters();
  const  trpc  = useTRPC();
  const { data } = useSuspenseQuery(trpc.agents.getMany.queryOptions({
    ...filters,
  }));

  return (
    <div className="flex-1 p-4 px-4 md:px-8 flex flex-col gap-y-4">
      <DataTable
      data={data.items}
      columns={columns}
      onRowClick={(row) => router.push(`/agentes/${row.id}`)}
      />
      <DataPagination
        page={filters.page}
        totalPages={data.totalPages}
        onPageChange={(page) => setFilters({page})}
      />
      {data.items.length === 0 &&(
        <EmptyState
        title="Crea tu primer agente"
        description="Crea un agente para unirte a tus sesiones. Cada agente seguirá tus 
        instrucciones"
        />

      )}
    </div>
  );
};

export const AgentsViewLoading = () => {
  return (
      <LoadingState
        title="Cargando agentes"
        description="Esto puede tomar unos segundos"
      />
    
  );
};

export const AgentsViewError = () => {
  return (
     <ErrorState
          title="Error al cargar agentes"
          description="Intenta de nuevo más tarde"
        />
  );
};